import express, { Router, Request, Response } from "express";
import { ProjectModel } from "../db";
import { upload } from "../middleware/upload";

const projectRouter = express.Router();

export const createProject = async (req: Request, res: Response) => {
    try {
        const { projectName, clientName, hourlyRate, currency } = req.body;

        const files = req.files as Express.Multer.File[];

        const scopeDocuments = files?.map(file => ({
            fileName: file.filename,
            filePath: file.path,
            originalName: file.originalname,
            mimeType: file.mimetype
        })) || [];

        const project = await ProjectModel.create({
            projectName,
            clientName,
            hourlyRate,
            currency,
            scopeDocuments
        });

        return res.status(201).json({
            success: true,
            message: "Project created successfully.",
            data: project
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to create project."
        });
    }
}

const getProjects = async (req: Request, res: Response) => {
    try {
        const projects = await ProjectModel.find().sort({
            createdAt: -1,
        });

        return res.status(200).json({
            success: true,
            data: projects,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unable to fetch projects.",
        });
    }
};

const getProjectById = async (req: Request, res: Response) => {
    try {
        const project = await ProjectModel.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found.",
            });
        }

        return res.status(200).json({
            success: true,
            data: project,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unable to fetch project.",
        });
    }
};

const updateProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updatedProject = await ProjectModel.findByIdAndUpdate(
            id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        );

        if (!updatedProject) {
            return res.status(404).json({
                success: false,
                message: "Project not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Project updated successfully.",
            data: updatedProject,
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Unable to update project.",
        });

    }
};

const deleteProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const project = await ProjectModel.findByIdAndDelete(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }
        return res.status(200).json({
            success: true,
            message: "Project deleted successfully."
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unable to delete project."
        });
    }
};

projectRouter.post("/", upload.array("scopeDocument", 20), createProject);
projectRouter.get("/", getProjects);
projectRouter.get("/:id", getProjectById);
projectRouter.patch("/:id", updateProject);
projectRouter.delete("/:id", deleteProject);

export default projectRouter;