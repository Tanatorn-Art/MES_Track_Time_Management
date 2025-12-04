import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'table' for tables, null/undefined for components

    const folderName = type === 'table' ? 'componentTable' : 'components';
    const targetDir = path.join(process.cwd(), 'config', folderName);

    // Try to read the directory
    let files: string[] = [];
    try {
      files = await readdir(targetDir);
    } catch {
      // Directory doesn't exist yet, return empty array
      return NextResponse.json({
        success: true,
        components: [],
      });
    }

    // Filter for JSON files and read their contents
    const components = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          const filePath = path.join(targetDir, file);
          try {
            const content = await readFile(filePath, 'utf-8');
            const config = JSON.parse(content);
            return {
              name: file.replace('.json', ''),
              path: `/config/${folderName}/${file}`,
              config,
            };
          } catch {
            return null;
          }
        })
    );

    return NextResponse.json({
      success: true,
      components: components.filter((c) => c !== null),
    });
  } catch (error) {
    console.error('Error loading components:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load components' },
      { status: 500 }
    );
  }
}
