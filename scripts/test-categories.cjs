#!/usr/bin/env node
/**
 * ABQ Unplugged — Category Mapping Tests
 *
 * Validates that place types are mapped to the correct categories,
 * especially the vibe system (Active, Chill, Date Night, Family, Culture).
 *
 * Usage: node scripts/test-categories.cjs
 */
'use strict';

// Replicate the placeTypeToCategory function from src/lib/db.ts
function placeTypeToCategory(types, name = '') {
  if (!types) return 'other';
  const n = name.toLowerCase();

  // Food / Drinks
  if (types.includes('convenience_store') || types.includes('gas_station')) return 'shop';
  if (types.includes('fast_food') && !types.includes('cafe')) return 'restaurant';

  const COFFEE_NAMES = ['coffee', 'cafe', 'café', 'espresso', 'roast', 'brew', 'java',
    'starbucks', "dunkin'", 'dunkin ', 'bean', 'grind', 'roasters', 'barista',
    'latte', 'cappuccino', 'grounds', 'drip', 'percolat'];
  const isCoffeeName = COFFEE_NAMES.some(w => n.includes(w));
  if (types.includes('coffee_shop') || (types.includes('cafe') && isCoffeeName)) return 'coffee';

  if (types.includes('restaurant') || types.includes('food') ||
      types.includes('cafe') || types.includes('fast_food') || types.includes('bakery') ||
      types.includes('meal_takeaway') || types.includes('meal_delivery')) return 'restaurant';
  if (types.includes('bar') || types.includes('night_club') ||
      types.includes('brewery') || types.includes('liquor_store')) return 'bar';

  // Outdoors
  if (types.includes('park') || types.includes('campground') ||
      types.includes('hiking_area') || types.includes('natural_feature') ||
      types.includes('rv_park')) return 'park';

  // Culture
  if (types.includes('museum') || types.includes('library')) return 'museum';
  if (types.includes('art_gallery') || types.includes('performing_arts_theater')) return 'arts';

  // Health/Medical — NOT fitness
  if (types.includes('dentist') || types.includes('doctor') ||
      types.includes('hospital') || types.includes('health') ||
      types.includes('veterinary_care') || types.includes('physiotherapist') ||
      types.includes('pharmacy')) return 'other';

  // Wellness (spas, salons — NOT active/fitness)
  if (types.includes('spa') || types.includes('beauty_salon') ||
      types.includes('hair_care')) return 'wellness';

  // Fitness (gyms, sports — genuinely active)
  if (types.includes('gym') || types.includes('fitness_center') ||
      types.includes('sports_complex') || types.includes('swimming_pool') ||
      types.includes('golf_course') || types.includes('stadium')) return 'fitness';

  // Stays
  if (types.includes('lodging') || types.includes('hotel') ||
      types.includes('motel') || types.includes('resort')) return 'hotel';

  // Shopping
  if (types.includes('shopping_mall') || types.includes('store') ||
      types.includes('clothing_store') || types.includes('shoe_store') ||
      types.includes('electronics_store') || types.includes('book_store') ||
      types.includes('jewelry_store') || types.includes('furniture_store') ||
      types.includes('home_goods_store') || types.includes('hardware_store') ||
      types.includes('car_dealer') || types.includes('bicycle_store') ||
      types.includes('pet_store') || types.includes('florist') ||
      types.includes('supermarket') || types.includes('convenience_store') ||
      types.includes('department_store') || types.includes('pharmacy') ||
      types.includes('gift_shop')) return 'shop';

  // Entertainment
  if (types.includes('amusement_park') || types.includes('bowling_alley') ||
      types.includes('movie_theater') || types.includes('zoo') ||
      types.includes('aquarium') || types.includes('casino') ||
      types.includes('tourist_attraction')) return 'entertainment';

  // Name-based fallbacks
  if (n.includes('theater') || n.includes('theatre') || n.includes('auditorium') ||
      n.includes('cinema') || n.includes('comedy') || n.includes('fun center') ||
      n.includes('escape room') || n.includes('bowling') || n.includes('arcade'))
    return 'entertainment';
  if (n.includes('gallery') || n.includes('studio') || n.includes('art ') ||
      n.includes('dance') || n.includes(' arts') || n.includes('music school') ||
      n.includes('pottery') || n.includes('ceramic'))
    return 'arts';
  if (n.includes('golf') || n.includes('crossfit') || n.includes('yoga') ||
      n.includes('pilates') || n.includes('martial art') || n.includes('boxing') ||
      n.includes('swim') || n.includes('aquatic') || n.includes('athletic'))
    return 'fitness';
  if (n.includes('library') || n.includes('historical') || n.includes('heritage') ||
      n.includes('history') || n.includes('science center') || n.includes('planetarium'))
    return 'museum';
  if (n.includes(' spa') || n.includes('salon') || n.includes('barbershop') ||
      n.includes('nail ') || n.includes('massage') || n.includes('wellness'))
    return 'wellness';
  if (n.includes('dispensary') || n.includes('cannabis') || n.includes('tattoo'))
    return 'shop';

  return 'other';
}

// ── Test cases ───────────────────────────────────────────────────────────────

const tests = [
  // === CRITICAL: Active vibe should NOT include spas, dentists, salons ===
  { name: 'Spa → wellness (NOT fitness)', types: ['spa'], expectedCat: 'wellness' },
  { name: 'Beauty salon → wellness', types: ['beauty_salon'], expectedCat: 'wellness' },
  { name: 'Hair care → wellness', types: ['hair_care'], expectedCat: 'wellness' },
  { name: 'Dentist → other (NOT fitness)', types: ['dentist'], expectedCat: 'other' },
  { name: 'Doctor → other (NOT fitness)', types: ['doctor'], expectedCat: 'other' },
  { name: 'Hospital → other', types: ['hospital'], expectedCat: 'other' },
  { name: 'Veterinarian → other', types: ['veterinary_care'], expectedCat: 'other' },
  { name: 'Name-based spa → wellness', types: ['point_of_interest'], placeName: 'Desert Spa & Wellness', expectedCat: 'wellness' },
  { name: 'Name-based salon → wellness', types: ['point_of_interest'], placeName: 'Bella Salon', expectedCat: 'wellness' },
  { name: 'Name-based massage → wellness', types: ['point_of_interest'], placeName: 'Deep Tissue Massage Center', expectedCat: 'wellness' },

  // === Active vibe SHOULD include these ===
  { name: 'Gym → fitness', types: ['gym'], expectedCat: 'fitness' },
  { name: 'Fitness center → fitness', types: ['fitness_center'], expectedCat: 'fitness' },
  { name: 'Sports complex → fitness', types: ['sports_complex'], expectedCat: 'fitness' },
  { name: 'Swimming pool → fitness', types: ['swimming_pool'], expectedCat: 'fitness' },
  { name: 'Golf course → fitness', types: ['golf_course'], expectedCat: 'fitness' },
  { name: 'Stadium → fitness', types: ['stadium'], expectedCat: 'fitness' },
  { name: 'Name-based CrossFit → fitness', types: ['point_of_interest'], placeName: 'CrossFit ABQ', expectedCat: 'fitness' },
  { name: 'Name-based yoga → fitness', types: ['point_of_interest'], placeName: 'Yoga Sala', expectedCat: 'fitness' },

  // === Parks / Outdoor ===
  { name: 'Park → park', types: ['park'], expectedCat: 'park' },
  { name: 'Campground → park', types: ['campground'], expectedCat: 'park' },
  { name: 'Hiking area → park', types: ['hiking_area'], expectedCat: 'park' },

  // === Food & Drink ===
  { name: 'Restaurant → restaurant', types: ['restaurant'], expectedCat: 'restaurant' },
  { name: 'Coffee shop → coffee', types: ['coffee_shop'], expectedCat: 'coffee' },
  { name: 'Cafe with coffee name → coffee', types: ['cafe'], placeName: 'Zendo Coffee', expectedCat: 'coffee' },
  { name: 'Cafe without coffee name → restaurant', types: ['cafe'], placeName: 'Golden Crown Panaderia', expectedCat: 'restaurant' },
  { name: 'Bar → bar', types: ['bar'], expectedCat: 'bar' },
  { name: 'Brewery → bar', types: ['brewery'], expectedCat: 'bar' },

  // === Culture ===
  { name: 'Museum → museum', types: ['museum'], expectedCat: 'museum' },
  { name: 'Art gallery → arts', types: ['art_gallery'], expectedCat: 'arts' },

  // === Entertainment ===
  { name: 'Movie theater → entertainment', types: ['movie_theater'], expectedCat: 'entertainment' },
  { name: 'Bowling → entertainment', types: ['bowling_alley'], expectedCat: 'entertainment' },
  { name: 'Zoo → entertainment', types: ['zoo'], expectedCat: 'entertainment' },

  // === Shopping ===
  { name: 'Store → shop', types: ['store'], expectedCat: 'shop' },
  { name: 'Cannabis → shop', types: ['point_of_interest'], placeName: 'Green Leaf Dispensary', expectedCat: 'shop' },
];

// ── Run tests ────────────────────────────────────────────────────────────────

console.log('\n🧪 ABQ Unplugged — Category Mapping Tests\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = placeTypeToCategory(test.types, test.placeName || '');
  const ok = result === test.expectedCat;

  if (ok) {
    passed++;
    console.log(`  ✓ ${test.name}`);
  } else {
    failed++;
    console.log(`  ✗ ${test.name}`);
    console.log(`    Expected: ${test.expectedCat}, Got: ${result}`);
  }
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Passed: ${passed}  |  Failed: ${failed}  |  Total: ${tests.length}`);
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
