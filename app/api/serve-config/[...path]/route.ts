import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// Serve files from the config folder
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const filePath = resolvedParams.path.join('/');
    const fullPath = path.join(process.cwd(), 'config', filePath);

    // Security check: ensure the path doesn't escape the config directory
    const configDir = path.join(process.cwd(), 'config');
    const resolvedPath = path.resolve(fullPath);

    if (!resolvedPath.startsWith(configDir)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const fileBuffer = await readFile(resolvedPath);

    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';

    switch (ext) {
      case '.json':
        contentType = 'application/json';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error serving config file:', error);
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }
}
