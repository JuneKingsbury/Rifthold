import { RELATIONSHIP_TIERS } from '../core/config.js';

export function getRelationshipTier(opinion) {
    if (opinion === undefined || opinion === null) return RELATIONSHIP_TIERS[1]; // stranger
    for (let i = RELATIONSHIP_TIERS.length - 1; i >= 0; i--) {
        if (opinion >= RELATIONSHIP_TIERS[i].minOpinion) return RELATIONSHIP_TIERS[i];
    }
    return RELATIONSHIP_TIERS[0];
}
