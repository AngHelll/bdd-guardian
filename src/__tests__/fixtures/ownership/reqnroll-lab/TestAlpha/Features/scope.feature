Feature: Tag scope

  @web
  Scenario: Web scope matches
    Given I log in with scoped credentials

  @api
  Scenario: Api scope matches
    Given I log in with scoped credentials

  Scenario: Bare scope matches nothing
    Given I log in with scoped credentials
