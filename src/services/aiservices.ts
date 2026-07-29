interface UploadedFile {
    fileName: string;
    fileData: Buffer;
    originalName: string;
    mimeType: string;
}

export const analyzeScope = async (
    scopeDocuments: UploadedFile[],
    chatFiles: UploadedFile[]
) => {

    const form = new FormData();

    for (const file of scopeDocuments) {
        form.append(
            "contract_files",
            new Blob([new Uint8Array(file.fileData)], { type: file.mimeType }),
            file.originalName
        );
    }

    for (const file of chatFiles) {
        form.append(
            "chat_logs",
            new Blob([new Uint8Array(file.fileData)], { type: file.mimeType }),
            file.originalName
        );
    }

    const response = await fetch(
        `${process.env.AI_SERVICE_URL}/analyze`,
        {
            method: "POST",
            body: form
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }

    return await response.json();
};