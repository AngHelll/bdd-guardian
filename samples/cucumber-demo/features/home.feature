@demo
Feature: Home Page

  Scenario Outline: Visit home page
    Given a valid "<user>" with password "<password>"
    When I navigate to the home
    Then I should see "Welcome to the Home Page"

    Examples:
      | user  | password |
      | admin | admin123 |
