import { getSupabaseClient } from '../../../../../lib/supabaseClient';

export type RequirementMaterialScanTarget = {
  requirementId: string;
  requirementName: string;
  chapterName?: string;
  description?: string;
};

export type RequirementMaterialScanInput = {
  subjectName?: string;
  topicName?: string;
  files: File[];
  targets: RequirementMaterialScanTarget[];
};

export type RequirementMaterialScanMatch = {
  requirementId: string;
  summary: string;
  sourceName?: string;
};

export async function scanRequirementMaterial(
  input: RequirementMaterialScanInput,
): Promise<RequirementMaterialScanMatch[]> {
  if (input.files.length === 0) return [];
  const supabase = getSupabaseClient();
  const parsed: RequirementMaterialScanMatch[] = [];

  for (const file of input.files) {
    const { data, error } = await supabase.functions.invoke('requirement-material-scan', {
      body: {
        subjectName: input.subjectName,
        topicName: input.topicName,
        files: [
          {
            name: file.name,
            mimeType: file.type || 'application/pdf',
            fileBase64: uint8ArrayToBase64(new Uint8Array(await file.arrayBuffer())),
          },
        ],
        targets: input.targets,
      },
    });

    const payload = await unwrapFunctionResponse(data, error, file.name);
    const matches = Array.isArray((payload as { matches?: unknown } | null)?.matches)
      ? ((payload as { matches: unknown[] }).matches ?? [])
      : [];

    parsed.push(
      ...matches
        .map<RequirementMaterialScanMatch | null>((match) => {
          const row = (match ?? null) as {
            requirementId?: unknown;
            summary?: unknown;
            sourceName?: unknown;
          } | null;
          const requirementId =
            typeof row?.requirementId === 'string' ? row.requirementId.trim() : '';
          const summary = typeof row?.summary === 'string' ? row.summary.trim() : '';
          if (!requirementId || !summary) return null;
          return {
            requirementId,
            summary,
            sourceName: typeof row?.sourceName === 'string' ? row.sourceName.trim() : undefined,
          };
        })
        .filter((match): match is RequirementMaterialScanMatch => match != null),
    );
  }

  if (parsed.length === 0) throw new Error('Keine verwertbaren Inhalte im Unterrichtsmaterial gefunden');
  return parsed;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

async function unwrapFunctionResponse(data: unknown, error: unknown, fileName?: string) {
  if (!error) {
    const d = data as { error?: unknown } | null;
    if (typeof d?.error === 'string' && d.error) throw new Error(d.error);
    return data;
  }

  const fnError = error as { message?: string; context?: { response?: Response } } | null;
  const resp = fnError?.context?.response;
  const status = resp?.status;
  if (status === 546) {
    throw new Error(
      fileName
        ? `Die PDF "${fileName}" war für einen einzelnen Scan-Worker zu groß oder zu aufwendig. Bitte versuche diese Datei separat oder in kleinere PDFs aufgeteilt.`
        : 'Die Anfrage war für den Scan-Worker zu groß oder zu aufwendig. Bitte weniger bzw. kleinere PDFs pro Durchlauf verwenden.',
    );
  }
  if (resp) {
    try {
      const text = await resp.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: unknown };
          if (typeof parsed.error === 'string' && parsed.error) throw new Error(parsed.error);
        } catch {
          throw new Error(text);
        }
      }
    } catch (readError) {
      if (readError instanceof Error) throw readError;
    }
  }

  throw new Error(fnError?.message || 'Edge Function Fehler');
}
