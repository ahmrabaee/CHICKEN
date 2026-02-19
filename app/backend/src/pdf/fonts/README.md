# Arabic Fonts Required

To support Arabic PDF generation, you must download the **Cairo** font family (or Amiri) and place the `.ttf` files in this directory.

1. Download **Cairo** from Google Fonts: https://fonts.google.com/specimen/Cairo
2. Extract the files.
3. Rename and copy the following files to this folder:
   - `Cairo-Regular.ttf`
   - `Cairo-Bold.ttf`

The `PdfService` is configured to look for these files. If they are missing, it will fall back to Roboto (English only).
