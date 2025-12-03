import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const componentsDir = path.join(process.cwd(), 'config', 'components');

    // Try to read the components directory
    let files: string[] = [];
    try {
      files = await readdir(componentsDir);
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
          const filePath = path.join(componentsDir, file);
          try {
            const content = await readFile(filePath, 'utf-8');
            const config = JSON.parse(content);
            return {
              name: file.replace('.json', ''),
              path: `/config/components/${file}`,
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
