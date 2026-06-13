const axios = require('axios');
const PDFDocument = require('pdfkit');
const timelineStorage = require('../utils/timelineStorage');
const { getClient } = require('../config/db');
const { ValidationError } = require('../middleware/error.middleware');
const logger = require('../utils/logger');
const env = require('../config/env');
const { cleanText } = require('../utils/textCleaner');

const AI_SERVICE_URL = env.aiService.url;

// Resolve 'me' placeholder to the authenticated user's ID from the auth middleware
const resolveUserId = (rawId, req) => {
  if (!rawId || rawId === 'me') return req.userId;
  return rawId;
};

/**
 * Add daily symptom timeline entry
 */
async function addEntry(req, res, next) {
  try {
    const { date, symptoms, raw_symptom_text, risk_level, triage_score, ai_summary, source, severity, temperature, notes, userId } = req.body;
    const effectiveUserId = resolveUserId(userId, req);

    if (!effectiveUserId) {
      throw new ValidationError('User ID is required');
    }
    if (!date) {
      throw new ValidationError('Date is required');
    }
    if (!symptoms) {
      throw new ValidationError('Symptoms text is required');
    }
    if (!severity) {
      throw new ValidationError('Severity is required');
    }

    logger.info('Adding timeline entry', { userId: effectiveUserId, date });

    const result = await timelineStorage.addEntry(effectiveUserId, {
      date,
      raw_symptom_text: cleanText(raw_symptom_text),
      symptoms: cleanText(symptoms),
      risk_level,
      triage_score,
      ai_summary: cleanText(ai_summary),
      source,
      severity: severity.toUpperCase(),
      temperature,
      notes: cleanText(notes)
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get symptom timeline for a user
 */
async function getEntries(req, res, next) {
  try {
    const { userId } = req.params;
    const effectiveUserId = resolveUserId(userId, req);

    if (!effectiveUserId) {
      throw new ValidationError('User ID is required');
    }

    logger.info('Fetching timeline entries', { userId: effectiveUserId });

    const result = await timelineStorage.getEntries(effectiveUserId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Generate progression analysis using Gemini via FastAPI
 */
async function analyzeTimeline(req, res, next) {
  try {
    const { userId } = req.body;
    const effectiveUserId = resolveUserId(userId, req);

    if (!effectiveUserId) {
      throw new ValidationError('User ID is required');
    }

    logger.info('Analyzing timeline progression', { userId: effectiveUserId });

    // Fetch entries
    const timelineData = await timelineStorage.getEntries(effectiveUserId);
    const entries = timelineData.data || [];

    if (entries.length === 0) {
      return res.status(200).json({
        success: false,
        summary: 'Cannot generate analysis. The symptom timeline is empty. Please add some daily symptom entries first.'
      });
    }

    // Call FastAPI AI service
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/triage/analyze_timeline`, {
        entries
      }, {
        timeout: 20000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.aiService.apiKey}`
        }
      });

      return res.status(200).json({
        success: true,
        summary: cleanText(response.data.summary),
        source: 'gemini'
      });
    } catch (aiError) {
      logger.error('FastAPI timeline analysis request failed:', aiError.message);
      
      // Fallback: Generate a simple heuristic rule-based summary using date groups
      const dateGroupsFallback = {};
      entries.forEach(e => {
        const dk = e.date || 'Unknown';
        if (!dateGroupsFallback[dk]) dateGroupsFallback[dk] = [];
        dateGroupsFallback[dk].push(e);
      });
      const uniqueDates = Object.keys(dateGroupsFallback).sort();
      const formatDate = (d) => {
        try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
      };

      const summaryLines = [
        'PATIENT TIMELINE SUMMARY (Fallback)',
        `• Tracked ${uniqueDates.length} unique day(s) across ${entries.length} symptom record(s).`,
        `• Timeline range: ${formatDate(uniqueDates[0])} → ${formatDate(uniqueDates[uniqueDates.length - 1])}.`,
        `• Symptoms reported: ${[...new Set(entries.map(e => e.symptoms.split(',')[0]))].join(', ')}.`,
        `• Peak reported severity: ${entries.some(e => e.severity === 'SEVERE') ? 'SEVERE' : entries.some(e => e.severity === 'MODERATE') ? 'MODERATE' : 'MILD'}.`
      ];
      
      const lastEntry = entries[entries.length - 1];
      if (lastEntry && lastEntry.temperature) {
        summaryLines.push(`• Latest temperature recorded at ${lastEntry.temperature}°F.`);
      }

      const fallbackSummary = summaryLines.join('\n') + '\n\nSuggested Clinical Focus:\nRoutine diagnostic workup.';
      
      return res.status(200).json({
        success: true,
        summary: cleanText(fallbackSummary),
        source: 'fallback_heuristic'
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing symptom timeline entry
 */
async function updateEntry(req, res, next) {
  try {
    const { id } = req.params;
    const { userId, symptoms, severity, temperature, notes } = req.body;
    const effectiveUserId = resolveUserId(userId, req);

    if (!effectiveUserId) {
      throw new ValidationError('User ID is required');
    }
    if (!symptoms) {
      throw new ValidationError('Symptoms text is required');
    }
    if (!severity) {
      throw new ValidationError('Severity is required');
    }

    logger.info('Updating timeline entry', { userId: effectiveUserId, entryId: id });

    const result = await timelineStorage.updateEntry(id, effectiveUserId, {
      symptoms: cleanText(symptoms),
      severity: severity.toUpperCase(),
      temperature,
      notes: cleanText(notes)
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a symptom timeline entry
 */
async function deleteEntry(req, res, next) {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const effectiveUserId = resolveUserId(userId, req);

    if (!effectiveUserId) {
      throw new ValidationError('User ID is required');
    }

    logger.info('Deleting timeline entry', { userId: effectiveUserId, entryId: id });

    const result = await timelineStorage.deleteEntry(id, effectiveUserId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Build PDF Buffer synchronously/asynchronously as a Promise
 */
async function buildPdfBuffer(userId, analysis = '') {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch timeline entries
      const timelineData = await timelineStorage.getEntries(userId);
      const entries = timelineData.data || [];

      // Fetch patient details (name, age, gender) if possible from users database
      let patientName = 'Valued Patient';
      let patientAge = 'N/A';
      let patientGender = 'N/A';
      const db = getClient();
      if (db) {
        try {
          const { data: userProfile } = await db
            .from('users')
            .select('name, age, gender')
            .eq('id', userId)
            .single();
          if (userProfile) {
            if (userProfile.name) patientName = cleanText(userProfile.name);
            if (userProfile.age) patientAge = String(userProfile.age);
            if (userProfile.gender) patientGender = cleanText(userProfile.gender);
          }
        } catch (err) {
          logger.warn('Could not fetch patient profile details for PDF:', err.message);
        }

        // If analysis is empty, try to fetch the latest summary from symptom_timeline
        if (!analysis) {
          try {
            const { data: latestTriage } = await db
              .from('symptom_timeline')
              .select('ai_summary')
              .eq('user_id', userId)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (latestTriage && latestTriage.ai_summary) {
              analysis = latestTriage.ai_summary;
            }
          } catch (triageErr) {
            logger.warn('Could not fetch latest triage summary for PDF fallback:', triageErr.message);
          }
        }
      }

      // Group timeline entries by date and remove duplicates
      const dateGroups = {};
      entries.forEach(e => {
        const dk = e.date || 'Unknown';
        if (!dateGroups[dk]) dateGroups[dk] = [];
        dateGroups[dk].push(e);
      });
      const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(a) - new Date(b));

      const consolidatedTimeline = sortedDates.map(dateKey => {
        const dayEntries = dateGroups[dateKey];
        
        // Deduplicate symptoms
        const symptomsSet = new Set();
        dayEntries.forEach(e => {
          if (e.symptoms) {
            e.symptoms.split(',').forEach(s => {
              const trimmed = cleanText(s).trim();
              if (trimmed) symptomsSet.add(trimmed);
            });
          }
        });
        const symptomsList = Array.from(symptomsSet);

        // Get highest severity
        let severity = 'Mild';
        const severities = dayEntries.map(e => (e.severity || '').toUpperCase());
        if (severities.includes('SEVERE')) severity = 'Severe';
        else if (severities.includes('MODERATE')) severity = 'Moderate';
        else if (severities.includes('MILD')) severity = 'Mild';

        // Get highest risk level
        let riskLevel = null;
        const risks = dayEntries.map(e => (e.risk_level || '').toUpperCase());
        if (risks.includes('HIGH')) riskLevel = 'High';
        else if (risks.includes('MODERATE')) riskLevel = 'Moderate';
        else if (risks.includes('LOW')) riskLevel = 'Low';

        // Get max temperature
        let maxTemp = null;
        dayEntries.forEach(e => {
          if (e.temperature) {
            const t = parseFloat(e.temperature);
            if (!isNaN(t)) {
              if (maxTemp === null || t > maxTemp) {
                maxTemp = t;
              }
            } else {
              maxTemp = e.temperature;
            }
          }
        });

        // Consolidate notes
        const notesSet = new Set();
        dayEntries.forEach(e => {
          const cleanNote = cleanText(e.notes).trim();
          if (cleanNote && cleanNote !== 'null' && cleanNote !== 'undefined') {
            notesSet.add(cleanNote);
          }
        });
        const notesList = Array.from(notesSet);

        return {
          dateKey,
          symptoms: symptomsList,
          severity,
          riskLevel,
          temperature: maxTemp,
          notes: notesList.join('; ')
        };
      });

      // Parse AI Clinical Summary and Doctor Consultation Summary
      let clinicalSummary = '';
      let doctorSummary = {
        chiefComplaints: '',
        duration: '',
        progression: '',
        riskAssessment: '',
        recommendedAction: ''
      };

      if (analysis) {
        const cleanAnalysis = cleanText(analysis);
        const aiSummaryIdx = cleanAnalysis.indexOf('AI CLINICAL SUMMARY');
        const docSummaryIdx = cleanAnalysis.indexOf('DOCTOR CONSULTATION SUMMARY');
        
        if (aiSummaryIdx !== -1 && docSummaryIdx !== -1) {
          const clinicalPart = cleanAnalysis.substring(aiSummaryIdx + 'AI CLINICAL SUMMARY'.length, docSummaryIdx).trim();
          clinicalSummary = clinicalPart.replace(/^[=\s-]+|[=\s-]+$/g, '').trim();
          
          const doctorPart = cleanAnalysis.substring(docSummaryIdx + 'DOCTOR CONSULTATION SUMMARY'.length).trim();
          const docCleaned = doctorPart.replace(/^[=\s-]+|[=\s-]+$/g, '').trim();
          
          const lines = docCleaned.split('\n');
          let currentField = '';
          lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('Chief Complaints:')) {
              currentField = 'chiefComplaints';
            } else if (trimmedLine.startsWith('Duration:')) {
              currentField = 'duration';
              doctorSummary.duration = trimmedLine.replace('Duration:', '').trim();
            } else if (trimmedLine.startsWith('Progression:')) {
              currentField = 'progression';
              doctorSummary.progression = trimmedLine.replace('Progression:', '').trim();
            } else if (trimmedLine.startsWith('Risk Assessment:')) {
              currentField = 'riskAssessment';
              doctorSummary.riskAssessment = trimmedLine.replace('Risk Assessment:', '').trim();
            } else if (trimmedLine.startsWith('Recommended Action:')) {
              currentField = 'recommendedAction';
              doctorSummary.recommendedAction = trimmedLine.replace('Recommended Action:', '').trim();
            } else if (trimmedLine && currentField) {
              if (currentField === 'chiefComplaints') {
                doctorSummary.chiefComplaints += (doctorSummary.chiefComplaints ? '\n' : '') + trimmedLine;
              } else {
                doctorSummary[currentField] += (doctorSummary[currentField] ? '\n' : '') + trimmedLine;
              }
            }
          });
        } else {
          clinicalSummary = cleanAnalysis;
        }
      }

      // Fallback heuristics if parsing didn't find doctorSummary values
      if (!doctorSummary.chiefComplaints && consolidatedTimeline.length > 0) {
        const allSymptoms = consolidatedTimeline.map(e => e.symptoms).flat();
        doctorSummary.chiefComplaints = Array.from(new Set(allSymptoms)).map(s => `- ${s}`).join('\n') || '- None reported';
      }
      if (!doctorSummary.duration && consolidatedTimeline.length > 0) {
        const days = consolidatedTimeline.length;
        doctorSummary.duration = days === 1 ? '1 Day' : `${days} Days`;
      }
      if (!doctorSummary.riskAssessment && consolidatedTimeline.length > 0) {
        const risks = consolidatedTimeline.map(e => e.riskLevel).filter(Boolean);
        if (risks.includes('High')) doctorSummary.riskAssessment = 'High Risk';
        else if (risks.includes('Moderate')) doctorSummary.riskAssessment = 'Moderate Risk';
        else doctorSummary.riskAssessment = 'Low Risk';
      }
      if (!doctorSummary.progression && consolidatedTimeline.length > 0) {
        const first = consolidatedTimeline[0];
        const last = consolidatedTimeline[consolidatedTimeline.length - 1];
        doctorSummary.progression = `Symptoms progressed from ${first.severity.toLowerCase()} ${first.symptoms.join(', ')} to ${last.severity.toLowerCase()} ${last.symptoms.join(', ')}.`;
      }
      if (!doctorSummary.recommendedAction) {
        doctorSummary.recommendedAction = doctorSummary.riskAssessment === 'High Risk' ? 'Urgent clinical evaluation.' : 'Routine outpatient medical consultation.';
      }

      // Initialize PDF document with page buffering
      const doc = new PDFDocument({ margin: 50, bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      let y = 70;

      // ─────────────────────────────────────────────────────────────
      //  1. MAIN TITLE
      // ─────────────────────────────────────────────────────────────
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(16).text('AROGYAAI MEDICAL ASSESSMENT REPORT', 50, y, { align: 'center' });
      y += 20;
      doc.moveTo(50, y).lineTo(562, y).strokeColor('#2e7d32').lineWidth(2).stroke(); // Green highlight line
      y += 15;

      // ─────────────────────────────────────────────────────────────
      //  2. PATIENT INFORMATION
      // ─────────────────────────────────────────────────────────────
      doc.fillColor('#333333').font('Helvetica-Bold').fontSize(11).text('Patient Information', 50, y);
      y += 15;

      const infoX1 = 60;
      const infoX2 = 280;
      
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9);
      doc.text('Name:', infoX1, y);
      doc.font('Helvetica').text(patientName, infoX1 + 90, y);

      doc.font('Helvetica-Bold').text('Patient ID:', infoX2, y);
      doc.font('Helvetica').text(userId, infoX2 + 90, y);
      y += 14;

      doc.font('Helvetica-Bold').text('Generated Date:', infoX1, y);
      doc.font('Helvetica').text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), infoX1 + 90, y);
      y += 14;

      doc.font('Helvetica-Bold').text('Age:', infoX1, y);
      doc.font('Helvetica').text(patientAge, infoX1 + 90, y);

      doc.font('Helvetica-Bold').text('Gender:', infoX2, y);
      doc.font('Helvetica').text(patientGender, infoX2 + 90, y);
      y += 20;

      doc.moveTo(50, y).lineTo(562, y).strokeColor('#dddddd').lineWidth(1).stroke();
      y += 15;

      // ─────────────────────────────────────────────────────────────
      //  3. AI CLINICAL SUMMARY
      // ─────────────────────────────────────────────────────────────
      doc.fillColor('#333333').font('Helvetica-Bold').fontSize(11).text('AI CLINICAL SUMMARY', 50, y);
      y += 15;
      
      const cleanClinicalSummary = clinicalSummary || 'No clinical summary available.';
      doc.fillColor('#000000').font('Helvetica').fontSize(9.5).text(cleanClinicalSummary, 60, y, {
        width: 480,
        lineGap: 3
      });
      y += doc.heightOfString(cleanClinicalSummary, { width: 480, lineGap: 3 }) + 20;

      if (y > 520) {
        doc.addPage();
        y = 70;
      }

      // ─────────────────────────────────────────────────────────────
      //  4. DOCTOR READY SUMMARY (DOCTOR CONSULTATION SUMMARY)
      // ─────────────────────────────────────────────────────────────
      doc.moveTo(50, y).lineTo(562, y).strokeColor('#dddddd').lineWidth(1).stroke();
      y += 15;

      doc.fillColor('#333333').font('Helvetica-Bold').fontSize(11).text('DOCTOR CONSULTATION SUMMARY', 50, y);
      y += 15;

      // Draw summary box dynamically
      let boxY = y + 10;
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9);
      
      doc.text('Chief Complaints:', 70, boxY);
      const complaintsText = doctorSummary.chiefComplaints.replace(/- /g, '• ');
      doc.font('Helvetica').text(complaintsText, 180, boxY, { width: 350 });
      boxY += Math.max(14, doc.heightOfString(complaintsText, { width: 350, fontSize: 9 })) + 6;

      doc.fillColor('#111111').font('Helvetica-Bold').text('Duration:', 70, boxY);
      doc.font('Helvetica').text(doctorSummary.duration, 180, boxY);
      boxY += 16;

      doc.fillColor('#111111').font('Helvetica-Bold').text('Progression:', 70, boxY);
      doc.font('Helvetica').text(doctorSummary.progression, 180, boxY, { width: 350 });
      boxY += Math.max(14, doc.heightOfString(doctorSummary.progression, { width: 350, fontSize: 9 })) + 6;

      doc.fillColor('#111111').font('Helvetica-Bold').text('Risk Assessment:', 70, boxY);
      doc.font('Helvetica').text(doctorSummary.riskAssessment, 180, boxY);
      boxY += 16;

      doc.fillColor('#111111').font('Helvetica-Bold').text('Recommended Action:', 70, boxY);
      doc.font('Helvetica-Bold').fillColor('#1b5e20').text(doctorSummary.recommendedAction, 180, boxY, { width: 350 });
      boxY += Math.max(14, doc.heightOfString(doctorSummary.recommendedAction, { width: 350, fontSize: 9 })) + 8;

      const boxHeight = boxY - y;
      
      // Draw background and green border
      doc.rect(55, y, 490, boxHeight).fillColor('#e8f5e9').fill(); // Very light green background
      doc.rect(55, y, 490, boxHeight).strokeColor('#2e7d32').lineWidth(1).stroke(); // Green highlights border
      
      // Draw text on top of background
      boxY = y + 10;
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9);
      doc.text('Chief Complaints:', 70, boxY);
      doc.font('Helvetica').text(complaintsText, 180, boxY, { width: 350 });
      boxY += Math.max(14, doc.heightOfString(complaintsText, { width: 350, fontSize: 9 })) + 6;

      doc.fillColor('#111111').font('Helvetica-Bold').text('Duration:', 70, boxY);
      doc.font('Helvetica').text(doctorSummary.duration, 180, boxY);
      boxY += 16;

      doc.fillColor('#111111').font('Helvetica-Bold').text('Progression:', 70, boxY);
      doc.font('Helvetica').text(doctorSummary.progression, 180, boxY, { width: 350 });
      boxY += Math.max(14, doc.heightOfString(doctorSummary.progression, { width: 350, fontSize: 9 })) + 6;

      doc.fillColor('#111111').font('Helvetica-Bold').text('Risk Assessment:', 70, boxY);
      doc.font('Helvetica').text(doctorSummary.riskAssessment, 180, boxY);
      boxY += 16;

      doc.fillColor('#111111').font('Helvetica-Bold').text('Recommended Action:', 70, boxY);
      doc.font('Helvetica-Bold').fillColor('#1b5e20').text(doctorSummary.recommendedAction, 180, boxY, { width: 350 });

      y += boxHeight + 20;

      if (y > 550) {
        doc.addPage();
        y = 70;
      }

      // ─────────────────────────────────────────────────────────────
      //  5. SYMPTOM TIMELINE
      // ─────────────────────────────────────────────────────────────
      doc.moveTo(50, y).lineTo(562, y).strokeColor('#dddddd').lineWidth(1).stroke();
      y += 15;

      doc.fillColor('#333333').font('Helvetica-Bold').fontSize(11).text('SYMPTOM TIMELINE', 50, y);
      y += 15;

      if (consolidatedTimeline.length === 0) {
        doc.fillColor('#666666').font('Helvetica-Oblique').fontSize(9.5).text('No daily symptom logs recorded in this timeline.', 60, y);
        y += 20;
      } else {
        consolidatedTimeline.forEach((entry, idx) => {
          if (y > 580) {
            doc.addPage();
            y = 70;
          }

          let displayDate = entry.dateKey;
          try {
            const d = new Date(entry.dateKey + 'T00:00:00');
            displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          } catch (e) {}

          doc.fillColor('#2e7d32').font('Helvetica-Bold').fontSize(10).text(displayDate, 60, y);
          y += 12;

          // Drawing timeline line structure
          const startLineY = y;
          
          doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9);
          doc.text('Symptoms:', 75, y);
          const formattedSymptoms = entry.symptoms.map(s => `• ${s}`).join('   ');
          doc.font('Helvetica').text(formattedSymptoms, 150, y, { width: 380 });
          y += 14;

          doc.font('Helvetica-Bold').text('Severity:', 75, y);
          doc.font('Helvetica').text(entry.severity, 150, y);
          
          if (entry.temperature) {
            doc.font('Helvetica-Bold').text('Temperature:', 250, y);
            doc.font('Helvetica').text(`${entry.temperature}°F`, 330, y);
          }
          y += 14;

          if (entry.riskLevel) {
            doc.font('Helvetica-Bold').text('Risk Level:', 75, y);
            doc.font('Helvetica').text(entry.riskLevel, 150, y);
            y += 14;
          }

          if (entry.notes) {
            doc.font('Helvetica-Bold').text('Patient Notes:', 75, y);
            doc.font('Helvetica-Oblique').text(entry.notes, 150, y, { width: 380 });
            y += Math.max(14, doc.heightOfString(entry.notes, { width: 380, fontSize: 9 })) + 4;
          }

          const endLineY = y;
          doc.moveTo(60, startLineY).lineTo(60, endLineY - 4).strokeColor('#2e7d32').lineWidth(1).stroke();
          
          y += 12; // Gap between dates
        });
      }

      // Add borders, header, footer decoration on all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Page border
        doc.rect(40, 40, 532, 712).strokeColor('#2e7d32').lineWidth(1.5).stroke(); // Green highlights border
        
        // Header
        doc.fillColor('#333333').font('Helvetica-Bold').fontSize(7.5).text('AROGYAAI CLINICAL ASSESSMENT REPORT', 50, 48);
        doc.moveTo(50, 58).lineTo(562, 58).strokeColor('#dddddd').lineWidth(0.5).stroke();

        // Footer
        doc.moveTo(50, 734).lineTo(562, 734).strokeColor('#dddddd').lineWidth(0.5).stroke();
        doc.fillColor('#666666').font('Helvetica').fontSize(7.5);
        doc.text('This document is a clinical synthesis generated by ArogyaAI triage assistant. Please consult with a physician.', 50, 740, { width: 400 });
        doc.text(`Page ${i + 1} of ${range.count}`, 500, 740, { width: 62, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate PDF report and stream download
 */
async function generatePdf(req, res, next) {
  try {
    const userId = req.body.userId || req.query.userId;
    const analysis = req.body.analysis || req.query.analysis || '';
    const effectiveUserId = resolveUserId(userId, req);

    if (!effectiveUserId) {
      throw new ValidationError('User ID is required');
    }

    logger.info('Generating timeline PDF report', { userId: effectiveUserId });
    const pdfBuffer = await buildPdfBuffer(effectiveUserId, analysis);

    // Set Response Headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="arogyaai-medical-report-${effectiveUserId.slice(0, 5)}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('PDF generation error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'PDF Generation failed', details: error.message });
    }
  }
}

module.exports = {
  addEntry,
  getEntries,
  updateEntry,
  deleteEntry,
  analyzeTimeline,
  buildPdfBuffer,
  generatePdf
};
