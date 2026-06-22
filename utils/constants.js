const allowedMimeTypes = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/zip": ".zip",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "text/plain": ".txt"
};

module.exports = {
  allowedMimeTypes,
  maxUploadSizeBytes: 100 * 1024 * 1024,
  accessTokenTtl: "7d"
};
