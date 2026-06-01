Feature: Eat godogs

  Scenario: Eat godogs
    Given there are 3 godogs
    When I eat 2
    Then there should be 1 remaining
