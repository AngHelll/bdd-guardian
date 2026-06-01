/**
 * Resolver dependency helpers
 */

import { getPreferSpecificBinding } from '../../config/matchingSettings';
import { ResolverDependencies } from './resolver';

/** Apply workspace matching settings to resolver dependencies */
export function applyMatchingSettings(deps: ResolverDependencies): ResolverDependencies {
    return {
        ...deps,
        preferSpecificBinding: getPreferSpecificBinding(),
    };
}
