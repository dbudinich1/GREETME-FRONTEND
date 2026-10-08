// src/utils/profileDeleteBlockers.js
//
// Release 2b (MILESTONE-release2b-photo-delete-blocker.md): when DELETE /api/profile/photo|voice refuses with
// 409 PROFILE_ASSET_IN_USE, the server now says WHAT still needs the asset (`inUseBy` + `blockers[]`, built only from the
// caller's own records). This turns that into one plain sentence. Returns null when the error is not that refusal, so the
// caller keeps its existing message.

const formatWhen = (iso) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
};

const OCCASION_WORDS = {
  birthday: 'birthday',
  anniversary: 'anniversary',
  work_anniversary: 'work anniversary',
};

function sentenceFor(b, thing) {
  const when = formatWhen(b && b.scheduledForUtc);
  if (b && b.kind === 'queued_send') {
    const occ = b.occasionType ? OCCASION_WORDS[b.occasionType] || String(b.occasionType).replace(/_/g, ' ') : null;
    const what = occ ? `A ${occ} greeting` : 'A greeting';
    return `${what}${when ? ` scheduled for ${when}` : ''} is about to send with ${thing}. Try again after it has been sent, or turn off that occasion's automatic send first.`;
  }
  if (b && b.kind === 'corporate_campaign') {
    // Release 2b assembly (T5 D2): a greeting already on its way (`status: 'queued'`) cannot be stopped by switching the
    // campaign off, so the only true advice is to wait until it has been sent. Older servers send no status: unchanged.
    if (b.status === 'queued') {
      const who = b.campaignName ? `A greeting from your corporate campaign "${b.campaignName}"` : 'A greeting from one of your corporate campaigns';
      return `${who}${when ? ` scheduled for ${when}` : ''} is about to send with ${thing}. Try again after it has been sent.`;
    }
    if (!when && !b.campaignName) {
      return `A corporate campaign still uses ${thing} as its sender ${thing === 'this photo' ? 'photo' : 'voice'}, so it can't be deleted yet.`;
    }
    const who = b.campaignName ? `Your corporate campaign "${b.campaignName}"` : 'One of your corporate campaigns';
    return `${who} still uses ${thing} for a greeting scheduled${when ? ` for ${when}` : ''}. Switch that campaign off or remove it, then try again.`;
  }
  return null;
}

/**
 * @param {any} error   the error thrown by api.request (carries .code and .data = the parsed 409 body)
 * @param {'photo'|'voice'} asset
 * @returns {string|null}
 */
export function describeProfileAssetInUse(error, asset = 'photo') {
  const data = error && (error.data || error);
  const code = (error && error.code) || (data && data.code);
  if (code !== 'PROFILE_ASSET_IN_USE') return null;
  const thing = asset === 'voice' ? 'this voice recording' : 'this photo';
  const blockers = Array.isArray(data && data.blockers) ? data.blockers.filter(Boolean) : [];
  if (blockers.length) {
    const first = sentenceFor(blockers[0], thing);
    if (first) {
      const more = blockers.length - 1;
      return more > 0 ? `${first} (${more} more scheduled greeting${more === 1 ? '' : 's'} also use${more === 1 ? 's' : ''} it.)` : first;
    }
  }
  // Older server: only the kind is known.
  if (data && data.inUseBy === 'corporate_campaign') {
    return `A corporate campaign still uses ${thing} for a scheduled greeting. Switch that campaign off or remove it, then try again.`;
  }
  if (data && data.inUseBy === 'queued_send') {
    return `A greeting that is about to send still uses ${thing}. Try again after it has been sent, or turn off that occasion's automatic send first.`;
  }
  return null;
}
