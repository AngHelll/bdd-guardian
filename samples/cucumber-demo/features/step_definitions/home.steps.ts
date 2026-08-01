import { Given, When, Then } from '@cucumber/cucumber';

Given('a valid {string} with password {string}', function (user: string, password: string) {
  this.user = user;
  this.password = password;
});

When('I navigate to the home', function () {
  this.page = 'home';
});

Then('I should see {string}', function (expected: string) {
  if (!expected) throw new Error('expected missing');
});
