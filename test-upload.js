const fs = require("fs");
const FormData = require("form-data");
const axios = require("axios");

const API_URL = "http://localhost:5000/api";

// Test user credentials
const testUser = {
  name: "Test User",
  email: "test@example.com",
  password: "TestPassword123"
};

async function runTest() {
  try {
    console.log("=== UPLOAD AND SHARE TEST ===\n");

    // Step 1: Create/login user
    console.log("1. Attempting to login...");
    let loginRes;
    try {
      loginRes = await axios.post(`${API_URL}/auth/login`, testUser);
      console.log("✓ Login successful");
    } catch (error) {
      if (error.response?.status === 401) {
        console.log("✓ User doesn't exist, registering...");
        const regRes = await axios.post(`${API_URL}/auth/register`, testUser);
        loginRes = await axios.post(`${API_URL}/auth/login`, testUser);
        console.log("✓ Registration and login successful");
      } else {
        throw error;
      }
    }

    const token = loginRes.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // Step 2: Upload a test file
    console.log("\n2. Uploading test file...");
    const testFilePath = "test-file.txt";
    fs.writeFileSync(testFilePath, "This is a test file for secure share.\n".repeat(10));

    const form = new FormData();
    form.append("file", fs.createReadStream(testFilePath));

    const uploadRes = await axios.post(`${API_URL}/files/upload`, form, {
      headers: {
        ...headers,
        ...form.getHeaders()
      }
    });

    const fileId = uploadRes.data._id;
    console.log("✓ File uploaded successfully");
    console.log(`  File ID: ${fileId}`);
    console.log(`  R2 Key: ${uploadRes.data.r2Key}`);

    // Step 3: Create a share link
    console.log("\n3. Creating share link...");
    const shareRes = await axios.post(
      `${API_URL}/shares/`,
      {
        fileId,
        password: "testpass",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxDownloads: 5
      },
      { headers }
    );

    const shareToken = shareRes.data.token;
    console.log("✓ Share created successfully");
    console.log(`  Share URL: ${shareRes.data.url}`);

    // Step 4: Get share info
    console.log("\n4. Getting share info...");
    const infoRes = await axios.get(`${API_URL}/shares/link/${shareToken}`);
    console.log("✓ Share info retrieved");
    console.log(`  File name: ${infoRes.data.fileName}`);
    console.log(`  Requires password: ${infoRes.data.requiresPassword}`);

    // Step 5: Verify password
    console.log("\n5. Verifying share password...");
    const verifyRes = await axios.post(`${API_URL}/shares/link/${shareToken}/access`, {
      password: "testpass"
    });
    console.log("✓ Password verified");
    console.log(`  Access token: ${verifyRes.data.accessToken.substring(0, 20)}...`);

    // Step 6: Download the file
    console.log("\n6. Downloading shared file...");
    const downloadRes = await axios.get(`${API_URL}/shares/link/${shareToken}/download`, {
      headers: {
        Authorization: `Bearer ${verifyRes.data.accessToken}`
      },
      responseType: "stream"
    });

    console.log("✓ File download started");
    console.log(`  Content-Type: ${downloadRes.headers["content-type"]}`);
    console.log(`  Content-Disposition: ${downloadRes.headers["content-disposition"]}`);

    // Pipe to a file to verify decryption
    const outFile = "downloaded-file.txt";
    downloadRes.data.pipe(fs.createWriteStream(outFile));

    await new Promise((resolve, reject) => {
      downloadRes.data.on("end", resolve);
      downloadRes.data.on("error", reject);
    });

    console.log(`✓ File downloaded to ${outFile}`);

    // Cleanup
    fs.unlinkSync(testFilePath);

    console.log("\n=== ALL TESTS PASSED ===");
  } catch (error) {
    console.error("\n✗ TEST FAILED");
    console.error("Error:", error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.error("Details:", error.response.data.error);
    }
    process.exit(1);
  }
}

runTest();
