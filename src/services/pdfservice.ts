import PDFDocument from "pdfkit";
import { AnalysisModel, ProjectModel, ScopeItemModel } from "../db";

const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£"
};

const colors = {
    primary: "#e60023",
    onPrimary: "#ffffff",
    ink: "#000000",
    body: "#33332e",
    mute: "#62625b",
    ash: "#91918c",
    stone: "#c8c8c1",
    hairline: "#dadad3",
    hairlineSoft: "#e5e5e0",
    canvas: "#ffffff",
    surfaceSoft: "#fbfbf9",
    surfaceCard: "#f6f6f3",
    surfaceDark: "#262622",
    onDark: "#ffffff",
    onDarkMute: "#c9c9c5",
    successDeep: "#103c25",
    successPale: "#c7f0da"
};

const radius = { md: 14, lg: 26, full: 999 };
// Tightened scale — the previous version stacked a trailing gap after each
// block AND a leading gap before the next section, so real gaps were ~1.8x
// these numbers. Values below are the actual on-page gap now.
const space = { xxs: 3, xs: 5, sm: 7, md: 10, lg: 14, xl: 20, xxl: 26 };

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CARD_PAD = 18;

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

    const fileName = `analysis-${analysis._id}-${Date.now()}.pdf`;
    const doc = new PDFDocument({ margin: PAGE_MARGIN, bufferPages: true, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const formatMoney = (amount: number) => `${symbol}${amount.toLocaleString()}`;

    const paintPageBackground = () => {
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.surfaceSoft);
        doc.fillColor(colors.body);
    };
    doc.on("pageAdded", paintPageBackground);
    paintPageBackground();

    const pageBottom = () => doc.page.height - doc.page.margins.bottom - 20;

    const ensureSpace = (height: number) => {
        if (doc.y + height > pageBottom()) {
            doc.addPage();
            doc.x = PAGE_MARGIN;
        }
    };

    const drawHairline = (y: number, color: string = colors.hairline, width: number = 0.75) => {
        doc.moveTo(PAGE_MARGIN, y)
            .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
            .lineWidth(width)
            .strokeColor(color)
            .stroke();
    };

    const measurePillWidth = (text: string, fontSize: number, paddingX: number) => {
        doc.font("Helvetica-Bold").fontSize(fontSize);
        return doc.widthOfString(text, { characterSpacing: 0.3 }) + paddingX * 2;
    };

    const drawPill = (
        text: string,
        x: number,
        y: number,
        opts?: { fontSize?: number; bg?: string; textColor?: string; paddingX?: number; height?: number }
    ) => {
        const { fontSize = 9, bg = colors.ink, textColor = colors.onDark, paddingX = 12, height = 22 } = opts ?? {};
        const width = measurePillWidth(text, fontSize, paddingX);
        doc.roundedRect(x, y, width, height, height / 2).fill(bg);
        doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(textColor)
            .text(text, x, y + (height - fontSize) / 2 - 1, { width, align: "center", characterSpacing: 0.3 });
        doc.fillColor(colors.body);
        return width;
    };

    const addSectionHeader = (title: string) => {
        ensureSpace(42);
        doc.y += space.xl;
        doc.x = PAGE_MARGIN;
        doc.font("Helvetica-Bold")
            .fontSize(13.5)
            .fillColor(colors.ink)
            .text(title, PAGE_MARGIN, doc.y, { characterSpacing: -0.2 });
        doc.y += 16;
        drawHairline(doc.y);
        doc.y += space.md;
    };

    const measureField = (value: string | number, width: number) => {
        doc.font("Helvetica-Bold").fontSize(10.5);
        return 13 + doc.heightOfString(String(value), { width });
    };

    const writeField = (label: string, value: string | number, x: number, width: number, y: number) => {
        doc.font("Helvetica").fontSize(8).fillColor(colors.mute)
            .text(label.toUpperCase(), x, y, { width, characterSpacing: 0.6 });
        doc.font("Helvetica-Bold").fontSize(10.5).fillColor(colors.ink)
            .text(String(value), x, y + 13, { width });
    };

    const writeFieldRow = (
        innerX: number, innerWidth: number, y: number,
        labelA: string, valueA: string | number,
        labelB: string, valueB: string | number
    ) => {
        const colWidth = (innerWidth - space.lg) / 2;
        writeField(labelA, valueA, innerX, colWidth, y);
        writeField(labelB, valueB, innerX + colWidth + space.lg, colWidth, y);
    };

    const emptyState = (message: string) => {
        doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(colors.ash)
            .text(message, PAGE_MARGIN, doc.y);
        doc.y += 14;
    };

    const drawFileTile = (label: string) => {
        ensureSpace(32);
        const tileHeight = 26;
        const y = doc.y;
        doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, tileHeight, radius.md).fill(colors.surfaceCard);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(colors.ink)
            .text(label, PAGE_MARGIN + CARD_PAD, y + 8, { width: CONTENT_WIDTH - CARD_PAD * 2, lineBreak: false });
        doc.y = y + tileHeight + space.xs;
        doc.x = PAGE_MARGIN;
    };

    // ---- Header -------------------------------------------------------------
    doc.y = PAGE_MARGIN;
    const headerRowY = doc.y;

    drawPill("SCOPE ANALYSIS", PAGE_MARGIN, headerRowY, {
        bg: colors.primary, textColor: colors.onPrimary, fontSize: 8, paddingX: 11, height: 20
    });

    doc.font("Helvetica").fontSize(8.5).fillColor(colors.ash)
        .text(`Generated ${new Date().toLocaleString()}`, PAGE_MARGIN, headerRowY + 4, {
            width: CONTENT_WIDTH, align: "right"
        });

    doc.y = headerRowY + 20 + space.md;
    doc.font("Helvetica-Bold").fontSize(26).fillColor(colors.ink)
        .text("Scope Change Report", PAGE_MARGIN, doc.y, { characterSpacing: -0.4 });

    doc.y += 30;
    doc.font("Helvetica").fontSize(11.5).fillColor(colors.mute)
        .text(project.projectName, PAGE_MARGIN, doc.y);

    doc.y += 22;
    drawHairline(doc.y);
    doc.y += space.sm;

    // ---- Project Information -------------------------------------------
    addSectionHeader("Project information");

    const infoInnerX = PAGE_MARGIN + CARD_PAD;
    const infoInnerWidth = CONTENT_WIDTH - CARD_PAD * 2;
    const colWidth = (infoInnerWidth - space.lg) / 2;
    const row1Height = Math.max(measureField(project.projectName, colWidth), measureField(project.clientName, colWidth));
    const row2Height = Math.max(
        measureField(`${formatMoney(project.hourlyRate)} / hr`, colWidth),
        measureField(project.currency, colWidth)
    );
    const infoBoxHeight = CARD_PAD + row1Height + space.md + row2Height + CARD_PAD;

    const infoBoxY = doc.y;
    doc.roundedRect(PAGE_MARGIN, infoBoxY, CONTENT_WIDTH, infoBoxHeight, radius.md).fill(colors.surfaceCard);

    writeFieldRow(infoInnerX, infoInnerWidth, infoBoxY + CARD_PAD, "Project name", project.projectName, "Client name", project.clientName);
    writeFieldRow(infoInnerX, infoInnerWidth, infoBoxY + CARD_PAD + row1Height + space.md, "Hourly rate", `${formatMoney(project.hourlyRate)} / hr`, "Currency", project.currency);

    doc.y = infoBoxY + infoBoxHeight + space.sm;
    doc.x = PAGE_MARGIN;

    // ---- Original Scope Documents ---------------------------------------
    addSectionHeader("Original scope documents");
    if (project.scopeDocuments.length === 0) {
        emptyState("No scope documents uploaded.");
    } else {
        project.scopeDocuments.forEach(file => drawFileTile(file.originalName ?? "Untitled file"));
    }

    // ---- Client Request Files -----------------------------------------------
    addSectionHeader("Client request files");
    if (analysis.chatFiles.length === 0) {
        emptyState("No request files uploaded.");
    } else {
        analysis.chatFiles.forEach(file => drawFileTile(file.originalName ?? "Untitled file"));
    }

    // ---- Approved Scope Changes ----------------------------------------------
    addSectionHeader("Approved scope changes");

    if (scopeItems.length === 0) {
        emptyState("No approved scope changes found.");
    } else {
        scopeItems.forEach((item, index) => {
            const hours = item.finalEstimatedHours ?? item.estimatedHours;
            const cost = hours * project.hourlyRate;
            const innerWidth = CONTENT_WIDTH - CARD_PAD * 2;

            doc.font("Helvetica-Bold").fontSize(13.5);
            const titleHeight = doc.heightOfString(item.featureName, { width: innerWidth, characterSpacing: -0.2 });

            doc.font("Helvetica").fontSize(9.5);
            const quoteHeight = doc.heightOfString(item.clientQuote, { width: innerWidth, lineGap: 4 });
            const reasonHeight = doc.heightOfString(item.reasoning, { width: innerWidth, lineGap: 4 });

            const badgeRowH = 20;
            const titleGap = space.sm;
            const hairlineGap = space.lg;
            const paragraphCaptionH = 10 + space.xxs;
            const paragraphGap = space.sm;
            const chipRowH = 22;

            const cardHeight =
                CARD_PAD +
                badgeRowH + titleGap +
                titleHeight + hairlineGap +
                paragraphCaptionH + quoteHeight + paragraphGap +
                paragraphCaptionH + reasonHeight + paragraphGap +
                chipRowH +
                CARD_PAD;

            ensureSpace(cardHeight + space.lg);

            const cardTop = doc.y;
            const cardBg = index % 2 === 0 ? colors.canvas : colors.surfaceCard;
            const chipBg = cardBg === colors.canvas ? colors.surfaceCard : colors.canvas;

            doc.roundedRect(PAGE_MARGIN, cardTop, CONTENT_WIDTH, cardHeight, radius.md).fill(cardBg);

            const innerX = PAGE_MARGIN + CARD_PAD;
            let y = cardTop + CARD_PAD;

            const badgeW = drawPill(`REQUEST ${String(index + 1).padStart(2, "0")}`, innerX, y, {
                bg: colors.ink, textColor: colors.onDark, fontSize: 8, paddingX: 10, height: badgeRowH
            });
            drawPill("APPROVED", innerX + badgeW + space.xs, y, {
                bg: colors.successPale, textColor: colors.successDeep, fontSize: 8, paddingX: 10, height: badgeRowH
            });

            y += badgeRowH + titleGap;
            doc.font("Helvetica-Bold").fontSize(13.5).fillColor(colors.ink)
                .text(item.featureName, innerX, y, { width: innerWidth, characterSpacing: -0.2 });

            y += titleHeight + space.xs;
            drawHairline(y, colors.hairlineSoft, 0.5);
            y += hairlineGap - space.xs;

            doc.font("Helvetica").fontSize(8).fillColor(colors.mute)
                .text("CLIENT REQUEST", innerX, y, { characterSpacing: 0.6 });
            y += paragraphCaptionH;
            doc.font("Helvetica").fontSize(9.5).fillColor(colors.body)
                .text(item.clientQuote, innerX, y, { width: innerWidth, lineGap: 4 });
            y += quoteHeight + paragraphGap;

            doc.font("Helvetica").fontSize(8).fillColor(colors.mute)
                .text("REASON", innerX, y, { characterSpacing: 0.6 });
            y += paragraphCaptionH;
            doc.font("Helvetica").fontSize(9.5).fillColor(colors.body)
                .text(item.reasoning, innerX, y, { width: innerWidth, lineGap: 4 });
            y += reasonHeight + paragraphGap;

            const hoursChipWidth = drawPill(`${hours} HRS`, innerX, y, {
                bg: chipBg, textColor: colors.ink, fontSize: 9, paddingX: 12, height: chipRowH
            });
            drawPill(formatMoney(cost), innerX + hoursChipWidth + space.xs, y, {
                bg: chipBg, textColor: colors.ink, fontSize: 9, paddingX: 12, height: chipRowH
            });

            doc.y = cardTop + cardHeight + space.lg;
            doc.x = PAGE_MARGIN;
        });
    }

    // ---- Summary ------------------------------------------------------------
    addSectionHeader("Summary");

    const summaryHeight = 86;
    ensureSpace(summaryHeight + 10);
    const summaryY = doc.y;
    const half = CONTENT_WIDTH / 2;

    doc.rect(PAGE_MARGIN, summaryY, CONTENT_WIDTH, summaryHeight).fill(colors.surfaceDark);

    doc.moveTo(PAGE_MARGIN + half, summaryY + 18)
        .lineTo(PAGE_MARGIN + half, summaryY + summaryHeight - 18)
        .lineWidth(0.5)
        .strokeColor(colors.surfaceCard)
        .strokeOpacity(0.15)
        .stroke()
        .strokeOpacity(1);

    const writeStat = (label: string, value: string, x: number, color: string) => {
        doc.font("Helvetica").fontSize(9).fillColor(colors.onDarkMute)
            .text(label, x, summaryY + 22, { width: half, align: "center", characterSpacing: 0.6 });
        doc.font("Helvetica-Bold").fontSize(25).fillColor(color)
            .text(value, x, summaryY + 37, { width: half, align: "center", characterSpacing: -0.4 });
    };

    writeStat("APPROVED HOURS", String(totalHours), PAGE_MARGIN, colors.onDark);
    writeStat("TOTAL COST", formatMoney(totalCost), PAGE_MARGIN + half, colors.primary);

    doc.y = summaryY + summaryHeight + space.sm;
    doc.x = PAGE_MARGIN;

    // ---- Notes ---------------------------------------------------------------
    addSectionHeader("Notes");
    doc.font("Helvetica").fontSize(9.5).fillColor(colors.mute)
        .text(
            "This report contains work identified as outside the original agreed scope. Pricing reflects only the approved additional work for this analysis.",
            PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 5 }
        );

    // ---- Footer: a stadium pill bar, reusing the doc's own pill language ----
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const originalBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const barHeight = 28;
        const barY = doc.page.height - originalBottomMargin - barHeight + 22;

        doc.roundedRect(PAGE_MARGIN, barY, CONTENT_WIDTH, barHeight, barHeight / 2).fill(colors.surfaceCard);

        const dotX = PAGE_MARGIN + 16;
        doc.circle(dotX, barY + barHeight / 2, 3).fill(colors.primary);

        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(colors.ink)
            .text("ScopeShield", dotX + 8, barY + barHeight / 2 - 3.5, { lineBreak: false });

        const wordmarkWidth = doc.widthOfString("ScopeShield", { characterSpacing: 0.2 });
        doc.font("Helvetica").fontSize(7.5).fillColor(colors.ash)
            .text("· Generated automatically", dotX + 8 + wordmarkWidth + 6, barY + barHeight / 2 - 3.5, { lineBreak: false });

        const pageLabel = `${String(i - range.start + 1).padStart(2, "0")} / ${String(range.count).padStart(2, "0")}`;
        const badgeWidth = measurePillWidth(pageLabel, 7.5, 10);
        drawPill(pageLabel, PAGE_MARGIN + CONTENT_WIDTH - badgeWidth - 5, barY + (barHeight - 18) / 2, {
            bg: colors.ink, textColor: colors.onDark, fontSize: 7.5, paddingX: 10, height: 18
        });

        doc.page.margins.bottom = originalBottomMargin;
    }

    doc.end();

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });

    analysis.pdf = {
        fileName,
        fileData: pdfBuffer,
        generatedAt: new Date(),
        version: analysis.pdf?.version ? analysis.pdf.version + 1 : 1
    };

    analysis.totalHours = totalHours;
    await analysis.save();

    return { fileName, totalHours, totalCost };
};