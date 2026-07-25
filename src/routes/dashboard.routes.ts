import express, { Request, Response } from "express";
import { ProjectModel, AnalysisModel, ScopeItemModel } from "../db";

const dashboardRouter = express.Router();

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const totalProjects = await ProjectModel.countDocuments();
    const activeProjects = await ProjectModel.countDocuments({ status: "ACTIVE" });
    const completedProjects = await ProjectModel.countDocuments({ status: "COMPLETED" });
    const totalAnalyses = await AnalysisModel.countDocuments();
    const pendingAnalysis = await AnalysisModel.countDocuments({ status: "PENDING" });
    const pendingScopeItems = await ScopeItemModel.countDocuments({ status: "REVIEW_PENDING" });
    const approvedScopeItems = await ScopeItemModel.countDocuments({ status: "APPROVED" });
    const dismissedScopeItems = await ScopeItemModel.countDocuments({ status: "DISMISSED" });

    const approvedItems = await ScopeItemModel.find({ status: "APPROVED" });
    let estimatedHours = 0;
    
    const revenueByCurrency: Record<string, number> = {};

    for (const item of approvedItems) {
      estimatedHours += item.finalEstimatedHours || 0;
      
      const analysis = await AnalysisModel.findById(item.analysisId);
      if (!analysis) continue;

      const project = await ProjectModel.findById(analysis.projectId);
      if (!project) continue;

      const projectCurrency = project.currency || "USD"; // Default fallback
      const itemRevenue = (item.finalEstimatedHours || 0) * (project.hourlyRate || 0);

      revenueByCurrency[projectCurrency] = (revenueByCurrency[projectCurrency] || 0) + itemRevenue;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalAnalyses,
        pendingAnalysis,
        pendingScopeItems,
        approvedScopeItems,
        dismissedScopeItems,
        estimatedHours,
        revenueByCurrency
      }
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load dashboard."
    });
  }
};

dashboardRouter.get("/", getDashboard);

export default dashboardRouter;