import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { componentName, config, type } = data;

    if (!componentName || !config) {
      return NextResponse.json(
        { success: false, error: 'Component name and config are required' },
        { status: 400 }
      );
    }

    // Sanitize component name for filename
    const safeName = componentName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

    // Define paths - components go to config/components folder, tables go to config/componentTable
    const configDir = path.join(process.cwd(), 'config');
    const targetDir = type === 'table'
      ? path.join(configDir, 'componentTable')
      : path.join(configDir, 'components');

    // Ensure directories exist
    await mkdir(configDir, { recursive: true });
    await mkdir(targetDir, { recursive: true });

    // Save component/table as JSON
    const componentPath = path.join(targetDir, `${safeName}.json`);
    await writeFile(componentPath, JSON.stringify(config, null, 2), 'utf-8');

    const folderName = type === 'table' ? 'componentTable' : 'components';
    return NextResponse.json({
      success: true,
      message: type === 'table' ? 'Table saved successfully' : 'Component saved successfully',
      componentPath: `/config/${folderName}/${safeName}.json`,
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
