const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Configure CORS to allow requests from any origin
app.use(cors());
app.use(express.json());

app.post("/generate-pdf", async (req, res) => {
  const url = "https://dev.visualisation.polimapper.co.uk/?dataSetKey=developer-test&client=testclientkillssss#con_over=Aberafan%20Maesteg";

  // Launch browser without specifying executablePath
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.emulateMediaType("screen");

  try {
    await page.goto(url, { waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Ensure all content is fully loaded

    await page.addStyleTag({
      content: `
        @media print {
          .custom-topbar {
            display: block;
            position: relative;
            width: 100%;
            border: 3px solid green;
          }
          body {
            padding-top: 120px;
          }
          @page {
            size: auto;
            margin: 1cm;
          }
          .hide-on-print {
            display: none;
          }
          footer, .footer, #footer {
            position: relative;
            bottom: 0;
            width: 100%;
            page-break-after: avoid;
          }
          div, p, table {
            page-break-inside: avoid;
            orphans: 3;
            widows: 3;
          }
        }
      `,
    });

    // Generate PDF and save it directly to disk for debugging
    const pdfPath = 'test-output.pdf';
    await page.pdf({
      path: pdfPath, // Save to disk
      printBackground: true,
      width: "15in",
    });

    // Set headers for inline display
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="downloaded-page.pdf"');

    // Stream the file directly from disk
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Failed to generate PDF: " + error.message);
  } finally {
    await browser.close();
  }
});

app.listen(port, () => {
  console.log(`PDF service running on http://localhost:${port}`);
});
