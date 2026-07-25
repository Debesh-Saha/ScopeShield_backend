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

export const generateAnalysisPdf = async (analysisId: string) => {
    const analysis = await AnalysisModel.findById(analysisId);

    if (!analysis) {
        throw new Error(
            "Analysis not found."
        );
    }

    const project = await ProjectModel.findById(analysis.projectId);

    if (!project) {
        throw new Error(
            "Project not found."
        );
    }


    const symbol = currencySymbols[project.currency] ?? "";

    const scopeItems = await ScopeItemModel.find({ analysisId, status: "APPROVED" }).sort({ createdAt: 1 });

    let totalHours = 0;
    let totalCost = 0;

    for (const item of scopeItems) {
        const hours = item.finalEstimatedHours ?? item.estimatedHours;
        totalHours += hours;
        totalCost += hours * project.hourlyRate;
    }

    const pdfFolder = path.join(process.cwd(), "uploads", "pdfs");

    if (!fs.existsSync(pdfFolder)) {
        fs.mkdirSync(pdfFolder,
            {
                recursive: true
            }
        );
    }

    const fileName = `analysis-${analysis._id}-${Date.now()}.pdf`;
    const pdfPath = path.join(pdfFolder, fileName);
    const dbPath = `uploads/pdfs/${fileName}`;

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    //Function to draw a line
    const drawLine = () => {
        doc
            .moveTo(50, doc.y)
            .lineTo(550, doc.y)
            .stroke();

        doc.moveDown();
    };

    //Function to add heading of a section
    const addSection = (title: string) => {
        doc
            .font("Helvetica-Bold")
            .fontSize(16)
            .fillColor("black")
            .text(title);

        drawLine();

        doc.moveDown(0.5);
    };

    //Function to format the cost
    const formatMoney = (amount: number) => {
        return `${symbol}${amount.toLocaleString()}`;
    };

    //Function to write the labels
    const writeLabelValue = (
        label: string,
        value: string | number
    ) => {
        doc
            .font("Helvetica-Bold")
            .fontSize(12)
            .fillColor("black")
            .text(label);

        doc
            .font("Helvetica")
            .fontSize(11)
            .text(String(value), {
                width: 480,
                align: "left"
            });

        doc.moveDown(0.5);
    };


    //Heading of the pdf
    doc.fontSize(22)
        .font("Helvetica-Bold")
        .text("SCOPE CHANGE REPORT", { align: "center" });
    doc.moveDown();

    //Project Information
    addSection("Project Information");

    writeLabelValue("Project Name:", project.projectName);
    writeLabelValue("Client Name:", project.clientName);
    writeLabelValue("Hourly Rate:", `${formatMoney(project.hourlyRate)} / hour`);
    writeLabelValue("Currency:", project.currency);
    writeLabelValue("Generated On:", new Date().toLocaleString());

    doc.moveDown();

    //Original Scope Documents
    addSection("Original Scope Documents");

    doc.moveDown(0.5);

    if (project.scopeDocuments.length === 0) {
        doc
            .font("Helvetica")
            .fontSize(12)
            .text("No scope documents uploaded.");
    }
    else {
        project.scopeDocuments.forEach(file => {
            doc
                .font("Helvetica")
                .fontSize(12)
                .text(`• ${file.originalName}`);

        });
    }
    doc.moveDown();

    //Client Request Change
    addSection("Client Request Files");

    doc.moveDown(0.5);

    if (analysis.chatFiles.length === 0) {
        doc
            .font("Helvetica")
            .fontSize(12)
            .text("No request files uploaded.");

    } else {
        analysis.chatFiles.forEach(file => {
            doc
                .font("Helvetica")
                .fontSize(12)
                .text(`• ${file.originalName}`);
        });
    }
    doc.moveDown();

    //Approved Scope Changes
    addSection("Approved Scope Changes");

    doc.moveDown();

    if (scopeItems.length === 0) {
        doc
            .font("Helvetica")
            .fontSize(12)
            .text("No approved scope changes found.");
    } else {
        scopeItems.forEach((item, index) => {
            const hours = item.finalEstimatedHours ?? item.estimatedHours;
            const cost = hours * project.hourlyRate;

            addSection(`Request #${index + 1}`);
            writeLabelValue("Feature:", item.featureName);
            writeLabelValue("Client Request:", item.clientQuote);
            writeLabelValue("Reason:", item.reasoning);
            writeLabelValue("Estimated Hours:", hours);
            writeLabelValue("Cost:", formatMoney(cost));
        });
    }


    doc.moveDown();


    //Summary
    addSection("Summary");

    doc.moveDown(0.5);

    doc
        .font("Helvetica")
        .fontSize(12)
        .text(`Approved Hours : ${totalHours}`)
        .text(`Total Cost : ${formatMoney(totalCost)}`);
    doc.moveDown();

    //Notes
    addSection("Notes");

    doc.moveDown(0.5);

    doc
        .font("Helvetica")
        .fontSize(11)
        .text(
            "This report contains work identified as outside the original agreed scope. Pricing reflects only the approved additional work for this analysis."
        );

    //Footer
    doc.moveDown(2);

    doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor("gray")
        .text(
            "Generated automatically by ScopeShield",
            {
                align: "center"
            }
        );

    doc.end();

    await new Promise(
        (resolve, reject) => {
            stream.on("finish", resolve);
            stream.on("error", reject);
        }
    );

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
}