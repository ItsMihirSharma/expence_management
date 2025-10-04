import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/server-auth';
import { generatePresignedPost } from '@/lib/file-upload';
import { z } from 'zod';

const presignedUrlSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().min(1).max(10 * 1024 * 1024) // 10MB max
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, mimeType, fileSize } = presignedUrlSchema.parse(body);

    const presignedData = await generatePresignedPost(fileName, mimeType, fileSize);

    return NextResponse.json({
      success: true,
      data: presignedData
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
