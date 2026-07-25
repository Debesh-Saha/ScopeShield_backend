import express, { Router, Request, Response } from "express";
import { ScopeItemModel, AnalysisModel } from "../db";

const scopeItemRouter = express.Router();

export const createScopeItems = async (req: Request, res: Response) => {
    try {
        const { analysisId } = req.params;
        const { items } = req.body;
        const analysis = await AnalysisModel.findById(analysisId);
        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: "Analysis not found."
            });
        }
        const scopeItems = items.map((item: any) => ({
            analysisId,
            featureName: item.featureName,
            clientQuote: item.clientQuote,
            reasoning: item.reasoning,
            estimatedHours: item.estimatedHours,      // AI estimate
            finalEstimatedHours: item.estimatedHours  // Initially same as AI
        }));

        const createdItems = await ScopeItemModel.insertMany(scopeItems);

        return res.status(201).json({
            success: true,
            message: "Scope items created successfully.",
            data: createdItems
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to create scope items."
        });
    }
};

export const getScopeItems = async (req: Request, res: Response) => {
    try {
        const { analysisId } = req.params;

        if (!analysisId || typeof analysisId !== 'string') {
            return res.status(400).json({
                success: false,
                message: "A valid analysisId is required."
            });
        }

        const items = await ScopeItemModel.find({ analysisId }).sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            data: items
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch scope items."
        });
    }
};

export const updateScopeItem = async (req: Request, res: Response) => {
    try {
        const { scopeItemId } = req.params;
        const updatedItem =
            await ScopeItemModel.findByIdAndUpdate(scopeItemId,
                req.body,
                {
                    new: true,
                    runValidators: true
                }

            );

        if (!updatedItem) {
            return res.status(404).json({
                success: false,
                message: "Scope Item not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Scope Item updated successfully.",
            data: updatedItem
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to update scope item."
        });
    }
};

export const deleteScopeItem = async (req: Request, res: Response) => {
    try {
        const { scopeItemId } = req.params;
        const deletedItem = await ScopeItemModel.findByIdAndDelete(scopeItemId);

        if (!deletedItem) {
            return res.status(404).json({
                success: false,
                message: "Scope Item not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Scope Item deleted successfully."
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to delete scope item."
        });
    }
};

scopeItemRouter.post("/:analysisId", createScopeItems);
scopeItemRouter.get("/:analysisId", getScopeItems);
scopeItemRouter.patch("/:scopeItemId", updateScopeItem);
scopeItemRouter.delete("/:scopeItemId", deleteScopeItem);

export default scopeItemRouter;