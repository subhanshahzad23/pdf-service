const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const fs = require("fs");
const { PDFDocument } = require('pdf-lib');
const app = express();
const port = process.env.PORT || 3000;

// Configure CORS to allow requests from any origin
app.use(cors());
app.use(express.json());

app.post("/generate-pdf", async (req, res) => {
  const {url} = req.body;
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.emulateMediaType("screen");

    await page.goto(url, { waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Ensure all content is fully loaded

    // Generate the first PDF with the header (first page only)
    const firstPagePdfPath = "first-page.pdf";
    await page.addStyleTag({
      content: `
        .topbar {
          display: fixed !important;
        }
      `,
    });
    await page.pdf({
      path: firstPagePdfPath,
      printBackground: true,
      width: "15in",
      pageRanges: "1", // Generate only the first page
    });

    // Generate the second PDF without the header (remaining pages)
    const remainingPagesPdfPath = "remaining-pages.pdf";
    await page.addStyleTag({
      content: `
        .topbar {
          display: none !important;
        }
      `,
    });
    await page.pdf({
      path: remainingPagesPdfPath,
      printBackground: true,
      width: "15in",
      pageRanges: "2-", // Generate all pages except the first
    });

    // Load the two PDFs
    const firstPagePdf = await PDFDocument.load(fs.readFileSync(firstPagePdfPath));
    const remainingPagesPdf = await PDFDocument.load(fs.readFileSync(remainingPagesPdfPath));

    // Create a new PDF document and merge the two PDFs
    const finalPdf = await PDFDocument.create();
    const [firstPage] = await finalPdf.copyPages(firstPagePdf, [0]);
    finalPdf.addPage(firstPage);

    const totalRemainingPages = remainingPagesPdf.getPageCount();
    for (let i = 0; i < totalRemainingPages; i++) {
      const [page] = await finalPdf.copyPages(remainingPagesPdf, [i]);
      finalPdf.addPage(page);
    }

    // Save the final merged PDF
    const finalPdfBytes = await finalPdf.save();
    const finalPdfPath = "final-output.pdf";
    fs.writeFileSync(finalPdfPath, finalPdfBytes);

    // Set headers for inline display
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="final-output.pdf"');

    // Stream the final PDF directly from disk
    const fileStream = fs.createReadStream(finalPdfPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error("Error generating PDF:", error); // Log detailed error information
    res.status(500).send("Failed to generate PDF: " + error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(port, () => {
  console.log(`PDF service running on http://localhost:${port}`);
});
