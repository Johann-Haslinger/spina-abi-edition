import { useEffect, useMemo, useState } from 'react';
import { useLocation, useMatches } from 'react-router-dom';
import type { Asset } from '../domain/models';
import { assetRepo } from '../repositories';
import { useSubjectsStore } from '../stores/subjectsStore';
import { useTopicsStore } from '../stores/topicsStore';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';

type CrumbKey = 'dashboard' | 'collection' | 'subject' | 'topic' | 'asset' | 'study';

function getCrumbKey(matches: ReturnType<typeof useMatches>): CrumbKey | null {
  for (let i = matches.length - 1; i >= 0; i--) {
    const key = (matches[i].handle as { crumb?: CrumbKey } | undefined)?.crumb;
    if (key) return key;
  }
  return null;
}

export function AutoBreadcrumbs() {
  const matches = useMatches();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const crumbKey = getCrumbKey(matches);

  const params = useMemo(() => {
    const merged: Record<string, string | undefined> = {};
    for (const m of matches) Object.assign(merged, m.params);
    return merged as {
      subjectId?: string;
      topicId?: string;
      assetId?: string;
    };
  }, [matches]);

  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const { topicsBySubject, refreshBySubject } = useTopicsStore();

  const [asset, setAsset] = useState<Asset | null>(null);
  useEffect(() => {
    if (crumbKey !== 'asset' && crumbKey !== 'study') return;
    const assetId = params.assetId;
    if (!assetId) return;
    let cancelled = false;
    async function run(id: string) {
      const a = await assetRepo.get(id);
      if (!cancelled) setAsset(a ?? null);
    }
    void run(assetId);
    return () => {
      cancelled = true;
    };
  }, [crumbKey, params.assetId]);

  const subjectId = params.subjectId ?? asset?.subjectId;
  const topicId = params.topicId ?? asset?.topicId;
  const assetTitle = asset?.title;

  const subject = useMemo(
    () => (subjectId ? subjects.find((s) => s.id === subjectId) : undefined),
    [subjects, subjectId],
  );

  const topic = useMemo(() => {
    if (!subjectId || !topicId) return undefined;
    return (topicsBySubject[subjectId] ?? []).find((t) => t.id === topicId);
  }, [topicsBySubject, subjectId, topicId]);

  useEffect(() => {
    if (!subjectId) return;
    if (subject) return;
    void refreshSubjects();
  }, [subjectId, subject, refreshSubjects]);

  useEffect(() => {
    if (!subjectId || !topicId) return;
    if (topic) return;
    void refreshBySubject(subjectId);
  }, [subjectId, topicId, topic, refreshBySubject]);

  const root: BreadcrumbItem =
    from === '/collection'
      ? { label: 'Sammlung', to: '/collection' }
      : from === '/dashboard'
        ? { label: 'Dashboard', to: '/dashboard' }
        : crumbKey === 'collection'
          ? { label: 'Sammlung', to: '/collection' }
          : { label: 'Dashboard', to: '/dashboard' };

  const items = useMemo(() => {
    const out: Array<BreadcrumbItem | null> = [root];

    if (subjectId) {
      out.push({
        label: subject?.name ?? 'Fach',
        to: `/subjects/${subjectId}`,
        state: from ? { from } : null,
      });
    }

    if (subjectId && topicId) {
      out.push({
        label: topic?.name ?? 'Thema',
        to: `/subjects/${subjectId}/topics/${topicId}`,
        state: from ? { from } : null,
      });
    }

    if ((crumbKey === 'asset' || crumbKey === 'study') && params.assetId) {
      const assetTo =
        subjectId && topicId
          ? `/subjects/${subjectId}/topics/${topicId}/${params.assetId}`
          : `/assets/${params.assetId}`;
      out.push({
        label: assetTitle ?? 'Asset',
        to: assetTo,
        state: from ? { from } : null,
      });
    }

    return out;
  }, [
    assetTitle,
    from,
    params.assetId,
    root,
    subject?.name,
    subjectId,
    topic?.name,
    topicId,
    crumbKey,
  ]);

  return <Breadcrumbs items={items} />;
}
