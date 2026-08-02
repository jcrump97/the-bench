import { describe, it, expect } from 'vitest';
import { reconcileCrossStageIds } from '../reconcileCase';
import { validCase } from '../../__tests__/fixtures';

const charge = validCase.charges[0]!;
const [evidence1, evidence2, evidence3] = validCase.evidence;
const [witness1, witness2] = validCase.witnesses;

describe('reconcileCrossStageIds', () => {
  it('renames a duplicate charge id, keeping the first claimant unchanged', () => {
    // Two stages each independently minting a charge id "c1" — the exact
    // shape a StatuteSelection retry can produce when the model reuses its
    // own prior id instead of generating a fresh one.
    const chargeA = charge; // id 'c1'
    const chargeB = { ...charge, id: charge.id, elements: [{ id: 'other-el', description: 'A different element.', isProven: false }] };

    const result = reconcileCrossStageIds({
      charges: [chargeA, chargeB],
      evidence: [evidence1!],
      witnesses: [witness1!],
    });

    expect(result.charges[0]!.id).toBe(chargeA.id);
    expect(result.charges[1]!.id).not.toBe(chargeA.id);
    expect(new Set(result.charges.map((c) => c.id)).size).toBe(2);
  });

  it('renames a duplicate element id shared across two different charges, keeping the first claimant', () => {
    const chargeA = charge; // id 'c1', elements include 'el1'
    const firstElementId = chargeA.elements[0]!.id;
    const chargeB = {
      ...charge,
      id: `${charge.id}-other`,
      elements: [{ id: firstElementId, description: 'A colliding element from a different charge.', isProven: false }],
    };

    const result = reconcileCrossStageIds({
      charges: [chargeA, chargeB],
      evidence: [evidence1!],
      witnesses: [witness1!],
    });

    const [resultChargeA, resultChargeB] = result.charges;
    expect(resultChargeA!.elements[0]!.id).toBe(firstElementId);
    expect(resultChargeB!.elements[0]!.id).not.toBe(firstElementId);
    const allElementIds = result.charges.flatMap((c) => c.elements.map((e) => e.id));
    expect(new Set(allElementIds).size).toBe(allElementIds.length);
  });

  it('renames a duplicate evidence id, keeping the first claimant unchanged', () => {
    const first = evidence1!;
    const second = { ...evidence2!, id: evidence1!.id };

    const result = reconcileCrossStageIds({
      charges: [charge],
      evidence: [first, second],
      witnesses: [witness1!],
    });

    expect(result.evidence[0]!.id).toBe(first.id);
    expect(result.evidence[1]!.id).not.toBe(first.id);
    expect(new Set(result.evidence.map((e) => e.id)).size).toBe(2);
  });

  it('renames a duplicate witness id, keeping the first claimant unchanged', () => {
    const first = witness1!;
    const second = { ...witness2!, id: witness1!.id };

    const result = reconcileCrossStageIds({
      charges: [charge],
      evidence: [evidence1!],
      witnesses: [first, second],
    });

    expect(result.witnesses[0]!.id).toBe(first.id);
    expect(result.witnesses[1]!.id).not.toBe(first.id);
    expect(new Set(result.witnesses.map((w) => w.id)).size).toBe(2);
  });

  it('keeps a renamed id at or under the 40-character cap even when the original id is already near the cap', () => {
    // ChargeSchema/WitnessSchema/EvidenceSchema all cap ids at 40 chars — a
    // naive rename (e.g. appending "-2") on an id already at the cap would
    // produce an invalid 42-char id that fails the very schema this repair
    // is supposed to satisfy.
    const longId = 'a'.repeat(40);
    const chargeA = { ...charge, id: longId };
    const chargeB = { ...charge, id: longId, elements: [{ id: 'distinct-el', description: 'x', isProven: false }] };

    const result = reconcileCrossStageIds({
      charges: [chargeA, chargeB],
      evidence: [evidence1!],
      witnesses: [witness1!],
    });

    expect(result.charges[0]!.id).toBe(longId);
    const renamed = result.charges[1]!.id;
    expect(renamed).not.toBe(longId);
    expect(renamed.length).toBeLessThanOrEqual(40);
  });

  it('resolves a second collision on the same id past "-2" without exceeding the cap', () => {
    // Three independent stages all mint the same near-cap id; the first
    // rename claims "-2", so the second collision has to notice that and
    // move on to "-3" instead of colliding again.
    const longId = 'b'.repeat(40);
    const chargeA = { ...charge, id: longId, elements: [{ id: 'el-a', description: 'x', isProven: false }] };
    const chargeB = { ...charge, id: longId, elements: [{ id: 'el-b', description: 'x', isProven: false }] };
    const chargeC = { ...charge, id: longId, elements: [{ id: 'el-c', description: 'x', isProven: false }] };

    const result = reconcileCrossStageIds({
      charges: [chargeA, chargeB, chargeC],
      evidence: [evidence1!],
      witnesses: [witness1!],
    });

    const ids = result.charges.map((c) => c.id);
    expect(ids[0]).toBe(longId);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(40);
  });

  it('preserves a targetElementId that matches an existing element', () => {
    const firstElementId = charge.elements[0]!.id;
    const referencingEvidence = { ...evidence1!, targetElementId: firstElementId };

    const result = reconcileCrossStageIds({
      charges: [charge],
      evidence: [referencingEvidence],
      witnesses: [witness1!],
    });

    expect(result.evidence[0]!.targetElementId).toBe(firstElementId);
  });

  it('nulls out a targetElementId that matches no element rather than inventing one', () => {
    const danglingEvidence = { ...evidence1!, targetElementId: 'no-such-element' };

    const result = reconcileCrossStageIds({
      charges: [charge],
      evidence: [danglingEvidence],
      witnesses: [witness1!],
    });

    expect(result.evidence[0]!.targetElementId).toBeNull();
  });

  it('returns an already-clean payload unchanged in content', () => {
    const parts = {
      charges: [charge],
      evidence: [evidence1!, evidence2!, evidence3!],
      witnesses: [witness1!, witness2!],
    };

    const result = reconcileCrossStageIds(parts);

    expect(result).toEqual(parts);
  });
});
