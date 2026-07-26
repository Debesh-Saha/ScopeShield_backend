import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

import { AnalysisModel, ProjectModel, ScopeItemModel } from "../db";

const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£"
};

// ---- Design tokens -------------------------------------------------------
const colors = {
    primary: "#1e293b",   // slate-800 (headers / band)
    accent: "#0d9488",    // teal-600 (rules / highlights)
    text: "#1e293b",      // body text
    muted: "#64748b",     // secondary labels
    faint: "#94a3b8",     // very light captions
    border: "#e2e8f0",    // hairlines / card borders
    surface: "#f8fafc",   // light card background
    summaryBg: "#ecfdf5", // soft accent background for totals
    white: "#ffffff"
};

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 612;   // Letter width at 72dpi
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

export const generateAnalysisPdf = async (analysisId: string) => {
    const analysis = await AnalysisModel.findById(analysisId);

    if (!analysis) {
        throw new Error("Analysis not found.");
    }

    const project = await ProjectModel.findById(analysis.projectId);

    if (!project) {
        throw new Error("Project not found.");
    }

    const symbol = currencySymbols[project.currency] ?? "";

    const scopeItems = await ScopeItemModel.find({
        analysisId,
        status: "APPROVED",
        isOutOfScope: true
    }).sort({ createdAt: 1 });

    let totalHours = 0;
    let totalCost = 0;

    for (const item of scopeItems) {
        const hours = item.finalEstimatedHours ?? item.estimatedHours;
        totalHours += hours;
        totalCost += hours * project.hourlyRate;
    }

    const pdfFolder = path.join(process.cwd(), "uploads", "pdfs");

    if (!fs.existsSync(pdfFolder)) {
        fs.mkdirSync(pdfFolder, { recursive: true });
    }

    const fileName = `analysis-${analysis._id}-${Date.now()}.pdf`;
    const pdfPath = path.join(pdfFolder, fileName);
    const dbPath = `uploads/pdfs/${fileName}`;

    const doc = new PDFDocument({ margin: PAGE_MARGIN, bufferPages: true, size: "LETTER" });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    const formatMoney = (amount: number) => `${symbol}${amount.toLocaleString()}`;

    // ---- Layout helpers ---------------------------------------------------

    const pageBottom = () => doc.page.height - doc.page.margins.bottom;

    /** Adds a new page if the upcoming block would overflow the current one. */
    const ensureSpace = (height: number) => {
        if (doc.y + height > pageBottom()) {
            doc.addPage();
        }
    };

    /** Thin rule across the content width at the current y. */
    const drawRule = (color: string = colors.border, width: number = 1) => {
        doc.moveTo(PAGE_MARGIN, doc.y)
            .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
            .lineWidth(width)
            .strokeColor(color)
            .stroke();
    };

    /** Section heading: small caps, accent underline, consistent spacing. */
    const addSectionHeader = (title: string) => {
        ensureSpace(46);
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold")
            .fontSize(12)
            .fillColor(colors.primary)
            .text(title.toUpperCase(), { characterSpacing: 0.6 });
        doc.moveDown(0.25);
        drawRule(colors.accent, 1.5);
        doc.moveDown(0.6);
    };

    /** A muted caption above a bold value — used for compact fact rows. */
    const writeField = (label: string, value: string | number, x: number, width: number) => {
        const y = doc.y;
        doc.font("Helvetica")
            .fontSize(8.5)
            .fillColor(colors.muted)
            .text(label.toUpperCase(), x, y, { width, characterSpacing: 0.4 });
        doc.font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(colors.text)
            .text(String(value), x, doc.y + 1, { width });
    };

    /** Two label/value pairs side by side, sharing a single row height. */
    const writeFieldRow = (
        labelA: string, valueA: string | number,
        labelB?: string, valueB?: string | number
    ) => {
        const colWidth = (CONTENT_WIDTH - 20) / 2;
        const startY = doc.y;
        writeField(labelA, valueA, PAGE_MARGIN, colWidth);
        const afterA = doc.y;
        if (labelB !== undefined && valueB !== undefined) {
            doc.y = startY;
            writeField(labelB, valueB, PAGE_MARGIN + colWidth + 20, colWidth);
        }
        doc.y = Math.max(afterA, doc.y);
        doc.moveDown(0.8);
    };

    /** Longer text field (client quote / reasoning) spanning the full width. */
    const writeParagraphField = (label: string, value: string) => {
        doc.font("Helvetica")
            .fontSize(8.5)
            .fillColor(colors.muted)
            .text(label.toUpperCase(), PAGE_MARGIN, doc.y, { characterSpacing: 0.4 });
        doc.font("Helvetica")
            .fontSize(10.5)
            .fillColor(colors.text)
            .text(value, PAGE_MARGIN, doc.y + 2, { width: CONTENT_WIDTH, lineGap: 2 });
        doc.moveDown(0.8);
    };

    const emptyState = (message: string) => {
        doc.font("Helvetica-Oblique")
            .fontSize(10.5)
            .fillColor(colors.faint)
            .text(message);
        doc.moveDown(0.6);
    };

    // ---- Cover / title band -------------------------------------------------
    doc.rect(0, 0, doc.page.width, 108).fill(colors.primary);

    doc.font("Helvetica-Bold")
        .fontSize(21)
        .fillColor(colors.white)
        .text("Scope Change Report", PAGE_MARGIN, 32);

    doc.font("Helvetica")
        .fontSize(11)
        .fillColor("#cbd5e1")
        .text(project.projectName, PAGE_MARGIN, 62);

    doc.font("Helvetica")
        .fontSize(9)
        .fillColor("#94a3b8")
        .text(`Generated ${new Date().toLocaleString()}`, PAGE_MARGIN, 62, {
            width: CONTENT_WIDTH,
            align: "right"
        });

    doc.fillColor(colors.text);
    doc.y = 140;

    // ---- Project Information -------------------------------------------
    addSectionHeader("Project Information");

    const infoBoxY = doc.y;
    const infoBoxHeight = 92;
    doc.roundedRect(PAGE_MARGIN, infoBoxY, CONTENT_WIDTH, infoBoxHeight, 4)
        .fillColor(colors.surface)
        .fill();
    doc.fillColor(colors.text);

    doc.y = infoBoxY + 14;
    writeFieldRow("Project Name", project.projectName, "Client Name", project.clientName);
    doc.x = PAGE_MARGIN;
    writeFieldRow(
        "Hourly Rate", `${formatMoney(project.hourlyRate)} / hr`,
        "Currency", project.currency
    );
    doc.x = PAGE_MARGIN;
    doc.y = infoBoxY + infoBoxHeight + 10;

    // ---- Original Scope Documents ---------------------------------------
    addSectionHeader("Original Scope Documents");

    if (project.scopeDocuments.length === 0) {
        emptyState("No scope documents uploaded.");
    } else {
        project.scopeDocuments.forEach(file => {
            ensureSpace(18);
            doc.font("Helvetica")
                .fontSize(10.5)
                .fillColor(colors.text)
                .text(`•  ${file.originalName}`);
            doc.moveDown(0.15);
        });
        doc.moveDown(0.4);
    }

    // ---- Client Request Files ---------------------------------------------
    addSectionHeader("Client Request Files");

    if (analysis.chatFiles.length === 0) {
        emptyState("No request files uploaded.");
    } else {
        analysis.chatFiles.forEach(file => {
            ensureSpace(18);
            doc.font("Helvetica")
                .fontSize(10.5)
                .fillColor(colors.text)
                .text(`•  ${file.originalName}`);
            doc.moveDown(0.15);
        });
        doc.moveDown(0.4);
    }

    // ---- Approved Scope Changes --------------------------------------------
    addSectionHeader("Approved Scope Changes");

    if (scopeItems.length === 0) {
        emptyState("No approved scope changes found.");
    } else {
        scopeItems.forEach((item, index) => {
            const hours = item.finalEstimatedHours ?? item.estimatedHours;
            const cost = hours * project.hourlyRate;

            // Reserve a little room so a card's header doesn't get orphaned
            // at the bottom of a page.
            ensureSpace(70);

            const cardY = doc.y;

            doc.font("Helvetica-Bold")
                .fontSize(9)
                .fillColor(colors.accent)
                .text(`REQUEST #${index + 1}`, PAGE_MARGIN, cardY, { characterSpacing: 0.5 });

            doc.font("Helvetica-Bold")
                .fontSize(12.5)
                .fillColor(colors.primary)
                .text(item.featureName, PAGE_MARGIN, doc.y + 2);

            doc.moveDown(0.5);
            drawRule(colors.border, 1);
            doc.moveDown(0.6);

            writeParagraphField("Client Request", item.clientQuote);
            writeParagraphField("Reason", item.reasoning);
            writeFieldRow("Estimated Hours", hours, "Cost", formatMoney(cost));
            doc.x = PAGE_MARGIN;

            doc.moveDown(0.3);
            if (index < scopeItems.length - 1) {
                drawRule(colors.border, 1);
                doc.moveDown(0.8);
            }
        });
    }

    // ---- Summary ------------------------------------------------------------
    addSectionHeader("Summary");

    const summaryHeight = 60;
    ensureSpace(summaryHeight + 10);
    const summaryY = doc.y;

    doc.roundedRect(PAGE_MARGIN, summaryY, CONTENT_WIDTH, summaryHeight, 4)
        .fillColor(colors.summaryBg)
        .fill();

    const summaryColWidth = CONTENT_WIDTH / 2;

    doc.font("Helvetica")
        .fontSize(9)
        .fillColor(colors.muted)
        .text("APPROVED HOURS", PAGE_MARGIN + 18, summaryY + 14, { characterSpacing: 0.4 });
    doc.font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(colors.primary)
        .text(String(totalHours), PAGE_MARGIN + 18, summaryY + 28);

    doc.font("Helvetica")
        .fontSize(9)
        .fillColor(colors.muted)
        .text("TOTAL COST", PAGE_MARGIN + summaryColWidth, summaryY + 14, { characterSpacing: 0.4 });
    doc.font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(colors.accent)
        .text(formatMoney(totalCost), PAGE_MARGIN + summaryColWidth, summaryY + 28);

    doc.y = summaryY + summaryHeight + 16;
    doc.x = PAGE_MARGIN;

    // ---- Notes ---------------------------------------------------------------
    addSectionHeader("Notes");
    doc.font("Helvetica")
        .fontSize(10)
        .fillColor(colors.muted)
        .text(
            "This report contains work identified as outside the original agreed scope. Pricing reflects only the approved additional work for this analysis.",
            { lineGap: 2 }
        );

    // ---- Footer & page numbers on every page ---------------------------------
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Writing below the normal bottom margin would otherwise make pdfkit
        // think the content overflowed and silently append a fresh blank
        // page for every footer we draw. Zero the margin out just for this,
        // then restore it so nothing else on the page is affected.
        const originalBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const footerY = doc.page.height - originalBottomMargin + 18;

        doc.moveTo(PAGE_MARGIN, footerY - 8)
            .lineTo(PAGE_MARGIN + CONTENT_WIDTH, footerY - 8)
            .lineWidth(0.75)
            .strokeColor(colors.border)
            .stroke();

        doc.font("Helvetica")
            .fontSize(8.5)
            .fillColor(colors.faint)
            .text("Generated automatically by ScopeShield", PAGE_MARGIN, footerY, {
                width: CONTENT_WIDTH / 2,
                align: "left",
                lineBreak: false
            });

        doc.font("Helvetica")
            .fontSize(8.5)
            .fillColor(colors.faint)
            .text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_MARGIN + CONTENT_WIDTH / 2, footerY, {
                width: CONTENT_WIDTH / 2,
                align: "right",
                lineBreak: false
            });

        doc.page.margins.bottom = originalBottomMargin;
    }

    doc.end();

    await new Promise<void>((resolve, reject) => {
        stream.on("finish", () => resolve());
        stream.on("error", reject);
    });

    analysis.pdf = {
        fileName,
        filePath: dbPath,
        generatedAt: new Date(),
        version: analysis.pdf?.version ? analysis.pdf.version + 1 : 1
    };

    analysis.totalHours = totalHours;
    await analysis.save();

    return {
        fileName,
        filePath: dbPath,
        totalHours,
        totalCost
    };
};