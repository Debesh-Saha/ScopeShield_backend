import express, { Router, Request, Response } from "express";
import { upload } from "../middleware/upload";
import { AnalysisModel, ProjectModel, ScopeItemModel } from "../db";
import { generateAnalysisPdf } from "../services/pdfservice";
import { authMiddleware } from "../middleware/authmiddleware";
import { analyzeScope } from "../services/aiservices";


const analysisRouter = express.Router();

export const createAnalysis = async (req: Request, res: Response) => {
    try {
        const projectId = req.params.projectId as string;

        // Check if project exists
        const project = await ProjectModel.findById(projectId).select("+scopeDocuments.fileData");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        // Uploaded chat files
        const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
        };

        // With memoryStorage, multer no longer generates file.filename /
        // file.path (those only exist for diskStorage). The raw bytes are
        // on file.buffer, so we store them directly on the document.
        const chatFiles =
            files?.chat?.map(file => ({
                fileName: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
                fileData: file.buffer,
                originalName: file.originalname,
                mimeType: file.mimetype
            })) || [];

        // Create analysis
        const analysis = await AnalysisModel.create({
            projectId,
            chatFiles,
            status: "PENDING"
        });

        // Convert mongoose DocumentArrays into normal arrays.
        // fileData (not filePath) now carries the actual bytes, since
        // nothing is written to disk anymore.
        const scopeDocs = project.scopeDocuments.map(file => ({
            fileName: file.fileName!,
            fileData: file.fileData as Buffer,
            originalName: file.originalName!,
            mimeType: file.mimeType!
        }));

        const chatDocs = analysis.chatFiles.map(file => ({
            fileName: file.fileName!,
            fileData: file.fileData as Buffer,
            originalName: file.originalName!,
            mimeType: file.mimeType!
        }));

        // Run AI only if both exist
        if (scopeDocs.length > 0 && chatDocs.length > 0) {

            try {

                const aiResult = await analyzeScope(
                    scopeDocs,
                    chatDocs
                );

                for (const item of aiResult) {

                    await ScopeItemModel.create({
                        analysisId: analysis._id,
                        featureName: item.featureName,
                        clientQuote: item.clientQuote,
                        reasoning: item.reasoning,
                        estimatedHours: item.estimatedHours,
                        finalEstimatedHours: item.estimatedHours,
                        isOutOfScope: item.isOutOfScope,
                        status: item.isOutOfScope
                            ? "REVIEW_PENDING"
                            : "APPROVED"
                    });

                }

                analysis.status = "COMPLETED";

            } catch (err) {

                console.error("AI Error:", err);

                analysis.status = "FAILED";
            }

            await analysis.save();
        }

        return res.status(201).json({
            success: true,
            message: "Analysis completed successfully.",
            data: analysis
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Unable to create analysis."
        });

    }
};

export const getAnalysisById = async (req: Request, res: Response) => {
    try {
        const { analysisId } = req.params;
        const analysis = await AnalysisModel.findById(analysisId);

        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: "Analysis not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: analysis
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch analysis."
        });
    }
};

export const getProjectAnalysis = async (req: Request, res: Response) => {
    try {
        const projectId = req.params.projectId as string;

        const analyses = await AnalysisModel.find({ projectId }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: analyses
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch analyses."
        });
    }
};

export const deleteAnalysis = async (req: Request, res: Response) => {
    try {
        const analysisId = req.params.analysisId as string;
        const analysis = await AnalysisModel.findById(analysisId);

        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: "Analysis not found."
            });
        }

        // Delete all scope items belonging to this analysis
        await ScopeItemModel.deleteMany({ analysisId });

        // Delete analysis
        await AnalysisModel.findByIdAndDelete(analysisId);

        return res.status(200).json({
            success: true,
            message: "Analysis deleted successfully."
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to delete analysis."
        });
    }
};

export const generatePdf = async (req: Request, res: Response) => {
    try {
        const analysisId = req.params.analysisId as string;
        const pdfData =
            await generateAnalysisPdf(
                analysisId
            );
        return res.status(200).json({
            success: true,
            message: "PDF generated successfully.",
            data: pdfData
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to generate PDF."
        });
    }
};

export const downloadPdf = async (req: Request, res: Response) => {
    try {
        const analysisId = req.params.analysisId as string;
        const analysis = await AnalysisModel.findById(analysisId).select("+pdf.fileData");

        if (!analysis || !analysis.pdf?.fileData) {
            return res.status(404).json({
                success: false,
                message: "PDF not found. Generate it first."
            });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${analysis.pdf.fileName}"`
        );
        return res.send(analysis.pdf.fileData);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to download PDF."
        });
    }
};

analysisRouter.post("/:projectId",
    upload.fields([
        {
            name: "chat",
            maxCount: 10
        }
    ]),
    createAnalysis
);
analysisRouter.get("/:analysisId", authMiddleware, getAnalysisById);
analysisRouter.get("/project/:projectId", authMiddleware, getProjectAnalysis);
analysisRouter.delete("/:analysisId", authMiddleware, deleteAnalysis);
analysisRouter.post("/:analysisId/generate-pdf", authMiddleware, generatePdf);
analysisRouter.get("/:analysisId/pdf", authMiddleware, downloadPdf);
export default analysisRouter;