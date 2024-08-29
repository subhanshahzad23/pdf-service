const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post("/generate-pdf", async (req, res) => {
  const {url} = req.body
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.emulateMediaType("screen");

    await page.goto(url, { waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Inject CSS for proper layout and spacing
    await page.addStyleTag({
      content: `
        @media print {
          /* General CSS adjustments for print */
          .section-to-avoid-split, .chart, .block, .table, .graph {
              page-break-inside: avoid;
              margin-bottom: 30px !important; /* Add spacing after each section */
              margin-top: 20px !important; /* Add spacing before each section */
          }

          .topbar, .header, .navbar {
              position: relative !important;
              top: 0 !important;
              z-index: 1 !important;
          }

          /* Ensure graphs do not have a background box */
          .graph, .chart, .block, .table {
              background-color: transparent !important;
              border: none !important;
              box-shadow: none !important;
          }

          /* Adjust the page size to allow for more content per page */
          @page {
              size: 15in auto; /* Adjusting height for more content */
              margin: 10mm; /* Add general margin */
          }
        }
      `,
    });

    // Generate the first PDF with header (first page only)
    const firstPagePdfPath = "first-page.pdf";
    await page.pdf({
      path: firstPagePdfPath,
      printBackground: true,
      width: "15in",
      pageRanges: "1",
    });

    // Generate the second PDF without the header (remaining pages)
    const remainingPagesPdfPath = "remaining-pages.pdf";
    await page.addStyleTag({
      content: `
        .topbar {
          display: none !important;
        }

        .content {
          margin-top: 20px !important;
        }
      `,
    });

    await page.pdf({
      path: remainingPagesPdfPath,
      printBackground: true,
      width: "15in",
      pageRanges: "2-",
    });

    // Load the two PDFs
    const firstPagePdf = await PDFDocument.load(
      fs.readFileSync(firstPagePdfPath)
    );
    const remainingPagesPdf = await PDFDocument.load(
      fs.readFileSync(remainingPagesPdfPath)
    );

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
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${req.body.nodeName || "final-output"}.pdf"`
    );

    // Stream the final PDF directly from disk
    const fileStream = fs.createReadStream(finalPdfPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error generating PDF:", error);
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
