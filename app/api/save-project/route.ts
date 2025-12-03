import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { projectName, config, images } = data;

    // Sanitize project name for filename
    const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

    // Define paths
    const configDir = path.join(process.cwd(), 'config');
    const imgDir = path.join(configDir, 'img');

    // Ensure directories exist
    await mkdir(configDir, { recursive: true });
    await mkdir(imgDir, { recursive: true });

    // Save images if provided
    const savedImages: Record<string, string> = {};

    if (images && typeof images === 'object') {
      for (const [key, imageData] of Object.entries(images)) {
        if (typeof imageData === 'string' && imageData.startsWith('data:')) {
          // Extract base64 data and mime type
          const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];

            // Determine file extension from mime type
            const ext = mimeType.split('/')[1] || 'png';
            const imageName = `${safeName}-${key}-${Date.now()}.${ext}`;
            const imagePath = path.join(imgDir, imageName);

            // Convert base64 to buffer and save
            const buffer = Buffer.from(base64Data, 'base64');
            await writeFile(imagePath, buffer);

            // Store relative path for config
            savedImages[key] = `/config/img/${imageName}`;
          }
        }
      }
    }

    // Update config with saved image paths
    const updatedConfig = { ...config };

    // Replace background image if it was saved
    if (savedImages.backgroundImage) {
      updatedConfig.backgroundImage = savedImages.backgroundImage;
    }

    // Replace any block images that were saved
    if (updatedConfig.blocks && Array.isArray(updatedConfig.blocks)) {
      updatedConfig.blocks = updatedConfig.blocks.map((block: { id: string; content?: string }) => {
        if (savedImages[`block-${block.id}`]) {
          return { ...block, content: savedImages[`block-${block.id}`] };
        }
        return block;
      });
    }

    // Save config as JSON
    const configPath = path.join(configDir, `${safeName}.json`);
    await writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Project saved successfully',
      configPath: `/config/${safeName}.json`,
      savedImages,
    });
  } catch (error) {
    console.error('Error saving project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save project' },
      { status: 500 }
    );
  }
}
