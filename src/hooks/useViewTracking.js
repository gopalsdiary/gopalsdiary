import { useEffect, useRef } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

export function useViewTracking(setCounts) {
    const viewQueueRef = useRef(new Map());

    // Flush views every 30 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            if (viewQueueRef.current.size === 0) return;

            const updates = Array.from(viewQueueRef.current.values());
            viewQueueRef.current.clear();

            for (const update of updates) {
                try {
                    const { data: existing } = await supabaseClient
                        .from('photo_clicks')
                        .select('*')
                        .eq('table_name', update.tableName)
                        .eq('photo_id', update.photoId)
                        .maybeSingle();

                    if (existing) {
                        await supabaseClient
                            .from('photo_clicks')
                            .update({ view_count: (Number(existing.view_count) || 0) + update.count })
                            .eq('table_name', update.tableName)
                            .eq('photo_id', update.photoId);
                    } else {
                        await supabaseClient
                            .from('photo_clicks')
                            .insert({
                                table_name: update.tableName,
                                photo_id: update.photoId,
                                click_count: 0,
                                view_count: update.count
                            });
                    }
                } catch (err) {
                    console.error('Error flushing view:', err);
                }
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const handleView = (photo) => {
        const key = `${photo.tableName}_${photo.id}`;

        console.log('📊 View tracked:', key);

        // Optimistic update locally
        setCounts(prev => {
            const current = prev[key] || { clicks: 0, views: 0 };
            const updated = {
                ...prev,
                [key]: {
                    ...current,
                    views: current.views + 1
                }
            };
            console.log('📊 Updated counts:', updated[key]);
            return updated;
        });

        // Add to batch queue
        const currentBatch = viewQueueRef.current.get(key) || {
            tableName: photo.tableName,
            photoId: photo.id,
            count: 0
        };

        viewQueueRef.current.set(key, {
            ...currentBatch,
            count: currentBatch.count + 1
        });

        console.log('📊 Queue size:', viewQueueRef.current.size);
    };

    return { handleView };
}
