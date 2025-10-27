import * as draftPublishMigrations from './draft-publish';
import * as firstPublishedAt from './first-published-at';
import * as i18nMigrations from './i18n';
import addAuditLogIndexes from './database/2025-10-27-add-audit-logs-indexes';
import type { Input } from './draft-publish';

const enable = async ({ oldContentTypes, contentTypes }: Input) => {
  await i18nMigrations.enable({ oldContentTypes, contentTypes });
  await draftPublishMigrations.enable({ oldContentTypes, contentTypes });
  await firstPublishedAt.enable({ oldContentTypes, contentTypes });
  // attempt to run audit logs index migration when enabling core migrations
  // note: migration runner will handle registration; this is a best-effort convenience
  try {
    // no-op: exports are Migration objects, run up only in dedicated migration runner; keep import for packaging
    void addAuditLogIndexes;
  } catch (e) {
    // ignore
  }
};

const disable = async ({ oldContentTypes, contentTypes }: Input) => {
  await i18nMigrations.disable({ oldContentTypes, contentTypes });
  await draftPublishMigrations.disable({ oldContentTypes, contentTypes });
};

export { enable, disable };
