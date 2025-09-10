export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const url = new URL(request.url);
    const downloadUrl = url.searchParams.get("url");
    const filename = url.searchParams.get("filename") || "download";

    if (!downloadUrl) {
      return new Response(
        JSON.stringify({ error: "Download URL is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log("Fetching:", downloadUrl);

    // Fetch file from upstream with redirect support
    const fileResponse = await fetch(downloadUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.status}`);
    }

    // Detect upstream content type
    let contentType =
      fileResponse.headers.get("content-type") || "application/octet-stream";

    // Choose extension based on content type
    let extension = "";
    if (contentType.includes("mp4")) extension = ".mp4";
    else if (contentType.includes("mpeg")) extension = ".mp3";
    else if (contentType.includes("jpeg") || contentType.includes("jpg"))
      extension = ".jpg";

    // Create safe filename
    const safeFilename = `${filename.replace(
      /[^a-zA-Z0-9-_\s]/g,
      "_"
    )}${extension}`;

    // Return streaming response
    return new Response(fileResponse.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Download proxy error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to download file",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
};
