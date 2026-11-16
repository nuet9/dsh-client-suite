window.__ModuleLoader__.load({
  id: '@local/claude-throughput-fix',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const key = 'localClaudeThroughputCorrection';
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.locale.register('localClaudeThroughputFix', {
          en: { average: 'Average output speed (including wait)' },
          zh: { average: '平均输出速度（含等待）' },
        });
        const translate = ctx.locale.bind('localClaudeThroughputFix');
        ctx.slots.inject('conversation.composer.dock', () => {
          // The public registry returns StoredEntry, including its original injection
          // and locale. Preserve both rather than importing private UI modules.
          if (typeof ctx.slots.entriesOfSlot !== 'function') {
            console.error('Claude throughput fix: unsupported slot registry; leaving built-in intact');
            return () => {};
          }
          const original = ctx.slots.entriesOfSlot('conversation.composer.dock').find(e => e.options.id === 'activity');
          if (!original || !original.component || original.children || original.store) {
            console.error('Claude throughput fix: unsupported activity entry; leaving built-in intact');
            return () => {};
          }
          function ClaudeThroughputActivity(props) {
            const correction = props.useProjection(key);
            const useProjection = React.useCallback((projectionKey, ...args) => {
              // Built-in ActivityPill reads the full sessionStats value (no selector).
              const value = props.useProjection(projectionKey, ...args);
              if (projectionKey !== 'sessionStats' || args.length > 0 || !value || !correction?.correctedSteps) return value;
              return { ...value, decodeMs: value.decodeMs + correction.extraDecodeMs,
                ttftMs: Math.max(0, value.ttftMs - correction.excludedTtftMs),
                ttftSteps: Math.max(0, value.ttftSteps - correction.excludedTtftSteps) };
            }, [props.useProjection, correction]);
            const t = React.useCallback((name, ...args) =>
              correction?.correctedSteps && name === 'stats.dialog.speed' ? translate('average') : props.t(name, ...args),
            [props.t, correction]);
            return h(original.component, { ...props, useProjection, t });
          }
          return ctx.slots.register({ name: 'conversation.composer.dock',
            id: 'activity', order: original.options.order ?? 0,
            priority: (original.options.priority ?? 0) - 1,
            ...(original.inject ? { inject: original.inject } : {}),
            ...(original.locale ? { locale: original.locale } : {}),
          }, ClaudeThroughputActivity);
        });
      },
    };
  },
});
