import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

// GET - List all saved projects or load a specific project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get('name');

    const configDir = path.join(process.cwd(), 'config');

    if (projectName) {
      // Load specific project
      const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const configPath = path.join(configDir, `${safeName}.json`);

      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      return NextResponse.json({
        success: true,
        config,
      });
    } else {
      // List all projects
      const files = await readdir(configDir);
      const projects = files
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file.replace('.json', ''),
          path: `/config/${file}`,
        }));

      return NextResponse.json({
        success: true,
        projects,
      });
    }
  } catch (error) {
    console.error('Error loading project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load project' },
      { status: 500 }
    );
  }
}
