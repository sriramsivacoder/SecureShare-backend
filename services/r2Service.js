const { PassThrough } = require("stream");
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const r2 = require("../config/r2");

async function uploadStream(key, contentLength, contentType = "application/octet-stream") {
  const body = new PassThrough();
  const uploadPromise = r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentLength: contentLength,
      ContentType: contentType
    })
  );

  return { writeStream: body, uploadPromise };
}

function getObjectStream(key) {
  return r2.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key
    })
  );
}

function deleteObject(key) {
  return r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key
    })
  );
}

module.exports = { uploadStream, getObjectStream, deleteObject };
