@Calculator @Math
Feature: Calculator Operations
  As a user
  I want to perform mathematical calculations
  So that I can verify the results

  Background:
    Given the calculator is initialized
    And the display shows "0"

  @P0 @smoke
  Scenario Outline: Basic arithmetic operations
    Given I have entered <first> into the calculator
    And I have entered <second> into the calculator
    When I press "<operation>"
    Then the result should be <result> on the screen
    But the memory should not be affected

    Examples: Addition
      | first | second | operation | result |
      | 50    | 70     | add       | 120    |
      | 100   | 200    | add       | 300    |

    Examples: Subtraction
      | first | second | operation | result |
      | 100   | 30     | subtract  | 70     |
      | 500   | 200    | subtract  | 300    |

  @P1 @functional
  Scenario: Division with quoted messages
    Given I have entered 100 into the calculator
    And I have entered 4 into the calculator
    When I press "divide"
    Then the result should be 25 on the screen
    And the status message should be "Division complete"
    But the error message should not contain "error"

  @P2 @edge-case
  Scenario: Handle whitespace in inputs
    Given I have entered    50    into the calculator
    And   I   have   entered   25   into   the   calculator
    When I press "add"
    Then the result should be 75 on the screen
