import type { CasePayload } from '../../schemas/gameSchemas';

// Deterministic repair of the two cross-stage invariants in CaseSchema's
// refinement: id uniqueness, and every `targetElementId` naming an element
// that exists.
//
// These are the only failures the assembled payload can have that no single
// stage could catch — each stage validated its own output in isolation, so a
// collision only appears once the pieces are put together. Until now the
// answer was to ask Gemini to regenerate the *entire* case (the largest
// response in the pipeline, most likely to truncate, discarding stage output
// that already passed). Both problems are mechanical, so they are fixed here
// and the LLM repair round is left for anything genuinely narrative.
//
// Charge ids, element ids, evidence ids and witness ids are four independent
// namespaces — CaseSchema checks each separately — so a charge and an exhibit
// may legitimately share an id.

const MAX_ID_LENGTH = 40;

// Keeps the first claimant of an id and renames later collisions, which is
// what makes the reference fixing below safe: an evidence item pointing at
// the original id still resolves to the element that kept it.
function claimUniqueId(id: string, taken: Set<string>): string {
  if (!taken.has(id)) {
    taken.add(id);
    return id;
  }
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${id.slice(0, MAX_ID_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

type Parts = Pick<CasePayload, 'charges' | 'evidence' | 'witnesses'>;

export function reconcileCrossStageIds(parts: Parts): Parts {
  const chargeIds = new Set<string>();
  const elementIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const witnessIds = new Set<string>();

  const charges = parts.charges.map((charge) => ({
    ...charge,
    id: claimUniqueId(charge.id, chargeIds),
    elements: charge.elements.map((element) => ({
      ...element,
      id: claimUniqueId(element.id, elementIds),
    })),
  }));

  const evidence = parts.evidence.map((item) => ({
    ...item,
    id: claimUniqueId(item.id, evidenceIds),
    // A dangling reference is dropped rather than guessed at. The field is
    // nullable precisely because an exhibit need not prove a specific
    // element, so null is a truthful answer; inventing a target would put a
    // wrong claim in the case file to satisfy a schema.
    targetElementId:
      item.targetElementId !== null && elementIds.has(item.targetElementId) ? item.targetElementId : null,
  }));

  const witnesses = parts.witnesses.map((witness) => ({
    ...witness,
    id: claimUniqueId(witness.id, witnessIds),
  }));

  return { charges, evidence, witnesses };
}
