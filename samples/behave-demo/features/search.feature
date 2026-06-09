@demo
Feature: Search

  Scenario: Search by text
    Given I have 5 cucumbers
    When I search for milk
    Then I should see "milk" in results
