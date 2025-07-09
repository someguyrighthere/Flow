// server.js (relevant part for documents DELETE)

apiRoutes.delete('/documents/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const docResult = await pool.query('SELECT file_name FROM documents WHERE document_id = $1', [id]);
        if (docResult.rows.length === 0) return res.status(404).json({ error: 'Document not found.' });

        const fileUrlToDelete = docResult.rows[0].file_name;

        // --- NEW: Delete from GCS (Attempt to delete, but don't block DB deletion) ---
        let isGcsUrl = false;
        let filePath = '';
        try {
            const url = new URL(fileUrlToDelete);
            if (url.hostname.includes('storage.googleapis.com') || url.hostname.includes(process.env.GCS_BUCKET_NAME)) {
                filePath = url.pathname.substring(1);
                isGcsUrl = true;
            }
        } catch (e) {
            console.warn(`File name "${fileUrlToDelete}" is not a valid URL. Assuming it's an old local file.`);
        }

        if (isGcsUrl) {
            try {
                const storageClient = new Storage({
                    projectId: gcsConfig.project_id,
                    credentials: {
                        client_email: gcsConfig.client_email,
                        private_key: gcsConfig.private_key.replace(/\\n/g, '\n')
                    }
                });
                const bucketName = process.env.GCS_BUCKET_NAME;
                await storageClient.bucket(bucketName).file(filePath).delete();
                console.log(`File ${filePath} deleted from GCS bucket ${bucketName}.`);
            } catch (gcsErr) {
                console.warn(`Could not delete file ${filePath} from GCS bucket ${bucketName}. It might not exist or permissions are off. Error: ${gcsErr.message}`);
            }
        } else {
            console.log(`Skipping GCS deletion for non-GCS URL: ${fileUrlToDelete}. Assuming it was an ephemeral local file.`);
        }
        // --- END NEW: Delete from GCS ---

        await pool.query('DELETE FROM documents WHERE document_id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting document record from database:', err); // More specific error message
        res.status(500).json({ error: 'Failed to delete document record.' });
    }
});