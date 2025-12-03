import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { componentName, config } = data;

    if (!componentName || !config) {
      return NextResponse.json(
        { success: false, error: 'Component name and config are required' },
        { status: 400 }
      );
    }

    // Sanitize component name for filename
    const safeName = componentName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

    // Define paths - components go to config/components folder
    const configDir = path.join(process.cwd(), 'config');
    const componentsDir = path.join(configDir, 'components');

    // Ensure directories exist
    await mkdir(configDir, { recursive: true });
    await mkdir(componentsDir, { recursive: true });

    // Save component as JSON
    const componentPath = path.join(componentsDir, `${safeName}.json`);
    await writeFile(componentPath, JSON.stringify(config, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Component saved successfully',
      componentPath: `/config/components/${safeName}.json`,
      name: safeName,
    });
  } catch (error) {
    console.error('Error saving component:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save component' },
      { status: 500 }
    );
  }
}
