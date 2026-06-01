import { Given, When, Then } from '@cucumber/cucumber';

Given('I have {int} cucumbers', function (count: number) {
  this.count = count;
});

When('I search for {string}', function (query: string) {
  this.query = query;
});

Then(/I should see "([^"]+)" in results/, function (expected: string) {
  if (!expected) throw new Error('expected missing');
});

