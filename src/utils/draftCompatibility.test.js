// src/utils/draftCompatibility.test.js
// Backward compatibility tests for greeting draft system

import {
  createGreetingDraft,
  createAnimatedPage,
  convertLegacyGreeting,
  convertDraftToSendFormat,
  validateDraft
} from '../models/greetingDraft.js';

/**
 * Test Suite: Backward Compatibility
 * Ensures that the new multi-page draft system works with existing single-page greetings
 */

// Mock data
const mockUser = {
  id: 'user123',
  email: 'user@example.com',
  voiceId: 'voice_abc123',
  photoUrl: 'https://example.com/photo.jpg'
};

const mockContact = {
  id: 'contact456',
  name: 'John Doe',
  email: 'john@example.com',
  relationship: 'friend',
  relationshipContext: 'Met at college',
  avatar: 'https://example.com/john-avatar.jpg',
  memoryPhotos: [
    'https://example.com/memory1.jpg',
    'https://example.com/memory2.jpg'
  ]
};

const legacyGreeting = {
  contactId: 'contact456',
  recipientName: 'John Doe',
  recipientEmail: 'john@example.com',
  greetingText: 'Happy Birthday, John! Hope you have a great day!',
  voiceId: 'voice_abc123',
  photoUrl: 'https://example.com/photo.jpg',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  personalSentiment: 'Hope you have a great day!'
};

/**
 * Test 1: Legacy greeting converts to draft correctly
 */
export function testLegacyToDraftConversion() {
  console.log('Test 1: Converting legacy greeting to draft...');

  const draft = convertLegacyGreeting(legacyGreeting);

  // Assertions
  const assertions = [
    {
      name: 'Draft has correct contact ID',
      condition: draft.contactId === legacyGreeting.contactId,
      expected: legacyGreeting.contactId,
      actual: draft.contactId
    },
    {
      name: 'Draft has correct occasion',
      condition: draft.occasionType === legacyGreeting.occasionKey,
      expected: legacyGreeting.occasionKey,
      actual: draft.occasionType
    },
    {
      name: 'Draft has exactly one page',
      condition: draft.pages.length === 1,
      expected: 1,
      actual: draft.pages.length
    },
    {
      name: 'Page is animated type',
      condition: draft.pages[0].type === 'animated',
      expected: 'animated',
      actual: draft.pages[0].type
    },
    {
      name: 'Page has correct script text',
      condition: draft.pages[0].scriptText === legacyGreeting.greetingText,
      expected: legacyGreeting.greetingText,
      actual: draft.pages[0].scriptText
    },
    {
      name: 'Page has correct photo URL',
      condition: draft.pages[0].photoUrl === legacyGreeting.photoUrl,
      expected: legacyGreeting.photoUrl,
      actual: draft.pages[0].photoUrl
    }
  ];

  return runAssertions('Legacy to Draft Conversion', assertions);
}

/**
 * Test 2: Draft converts back to send format correctly
 */
export function testDraftToSendFormatConversion() {
  console.log('Test 2: Converting draft to send format...');

  // Create a simple single-page draft
  const draft = createGreetingDraft({
    contactId: mockContact.id,
    occasionType: 'birthday',
    pages: [
      createAnimatedPage({
        photoUrl: mockUser.photoUrl,
        voiceId: mockUser.voiceId,
        scriptText: 'Happy Birthday!',
        useDefaultVoice: true
      })
    ],
    customMessage: 'Have a great day!'
  });

  const sendFormat = convertDraftToSendFormat(draft, mockContact, mockUser);

  // Assertions
  const assertions = [
    {
      name: 'Has userId',
      condition: sendFormat.userId === mockUser.id,
      expected: mockUser.id,
      actual: sendFormat.userId
    },
    {
      name: 'Has recipient name',
      condition: sendFormat.recipientName === mockContact.name,
      expected: mockContact.name,
      actual: sendFormat.recipientName
    },
    {
      name: 'Has recipient email',
      condition: sendFormat.recipientEmail === mockContact.email,
      expected: mockContact.email,
      actual: sendFormat.recipientEmail
    },
    {
      name: 'Has greeting text from page',
      condition: sendFormat.greetingText === 'Happy Birthday!',
      expected: 'Happy Birthday!',
      actual: sendFormat.greetingText
    },
    {
      name: 'Has voiceId',
      condition: sendFormat.voiceId === mockUser.voiceId,
      expected: mockUser.voiceId,
      actual: sendFormat.voiceId
    },
    {
      name: 'Has photoUrl',
      condition: sendFormat.photoUrl === mockUser.photoUrl,
      expected: mockUser.photoUrl,
      actual: sendFormat.photoUrl
    },
    {
      name: 'Has occasion key',
      condition: sendFormat.occasionKey === 'birthday',
      expected: 'birthday',
      actual: sendFormat.occasionKey
    }
  ];

  return runAssertions('Draft to Send Format Conversion', assertions);
}

/**
 * Test 3: Draft validation works correctly
 */
export function testDraftValidation() {
  console.log('Test 3: Testing draft validation...');

  // Valid draft
  const validDraft = createGreetingDraft({
    contactId: 'contact123',
    occasionType: 'birthday',
    pages: [
      createAnimatedPage({
        photoUrl: 'https://example.com/photo.jpg',
        scriptText: 'Happy Birthday!',
        useDefaultVoice: true
      })
    ]
  });

  const validResult = validateDraft(validDraft);

  // Invalid draft (missing contact)
  const invalidDraft = createGreetingDraft({
    contactId: '',
    occasionType: 'birthday',
    pages: []
  });

  const invalidResult = validateDraft(invalidDraft);

  const assertions = [
    {
      name: 'Valid draft passes validation',
      condition: validResult.valid === true,
      expected: true,
      actual: validResult.valid
    },
    {
      name: 'Valid draft has no errors',
      condition: validResult.errors.length === 0,
      expected: 0,
      actual: validResult.errors.length
    },
    {
      name: 'Invalid draft fails validation',
      condition: invalidResult.valid === false,
      expected: false,
      actual: invalidResult.valid
    },
    {
      name: 'Invalid draft has errors',
      condition: invalidResult.errors.length > 0,
      expected: 'greater than 0',
      actual: invalidResult.errors.length
    }
  ];

  return runAssertions('Draft Validation', assertions);
}

/**
 * Test 4: Multi-page draft maintains all pages
 */
export function testMultiPageDraft() {
  console.log('Test 4: Testing multi-page draft...');

  const multiPageDraft = createGreetingDraft({
    contactId: 'contact123',
    occasionType: 'birthday',
    pages: [
      createAnimatedPage({
        photoUrl: 'photo1.jpg',
        scriptText: 'Page 1',
        useDefaultVoice: true
      }),
      createAnimatedPage({
        photoUrl: 'photo2.jpg',
        scriptText: 'Page 2',
        useDefaultVoice: true
      })
    ]
  });

  const assertions = [
    {
      name: 'Draft has 2 pages',
      condition: multiPageDraft.pages.length === 2,
      expected: 2,
      actual: multiPageDraft.pages.length
    },
    {
      name: 'First page has correct text',
      condition: multiPageDraft.pages[0].scriptText === 'Page 1',
      expected: 'Page 1',
      actual: multiPageDraft.pages[0].scriptText
    },
    {
      name: 'Second page has correct text',
      condition: multiPageDraft.pages[1].scriptText === 'Page 2',
      expected: 'Page 2',
      actual: multiPageDraft.pages[1].scriptText
    }
  ];

  return runAssertions('Multi-Page Draft', assertions);
}

/**
 * Helper function to run assertions and report results
 */
function runAssertions(testName, assertions) {
  console.log(`\n=== ${testName} ===`);

  let passed = 0;
  let failed = 0;

  assertions.forEach(assertion => {
    if (assertion.condition) {
      console.log(`✓ ${assertion.name}`);
      passed++;
    } else {
      console.error(`✗ ${assertion.name}`);
      console.error(`  Expected: ${assertion.expected}`);
      console.error(`  Actual: ${assertion.actual}`);
      failed++;
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  return {
    testName,
    passed,
    failed,
    total: assertions.length,
    success: failed === 0
  };
}

/**
 * Run all tests
 */
export function runAllCompatibilityTests() {
  console.log('\n🧪 Running Backward Compatibility Tests\n');
  console.log('========================================\n');

  const results = [
    testLegacyToDraftConversion(),
    testDraftToSendFormatConversion(),
    testDraftValidation(),
    testMultiPageDraft()
  ];

  console.log('\n========================================');
  console.log('📊 Test Summary\n');

  const totalTests = results.reduce((sum, r) => sum + r.total, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

  results.forEach(result => {
    const status = result.success ? '✓' : '✗';
    console.log(`${status} ${result.testName}: ${result.passed}/${result.total}`);
  });

  console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed`);

  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed! Backward compatibility verified.\n');
  } else {
    console.log(`\n⚠️  ${totalFailed} test(s) failed. Review errors above.\n`);
  }

  return {
    success: totalFailed === 0,
    totalTests,
    totalPassed,
    totalFailed,
    results
  };
}

// Export for manual testing in browser console
if (typeof window !== 'undefined') {
  window.testDraftCompatibility = runAllCompatibilityTests;
}

export default {
  runAllCompatibilityTests,
  testLegacyToDraftConversion,
  testDraftToSendFormatConversion,
  testDraftValidation,
  testMultiPageDraft
};
