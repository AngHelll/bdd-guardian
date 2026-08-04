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

  # --- v0.5.0 Capa B extras (see README) ---

  @v050 @ambiguity
  Scenario: Overlapping Then patterns (Reqnroll-like ambiguous)
    # Bindings: ThenTheResultShouldBe (.*) AND ThenTheResultShouldBeNumeric (\d+)
    # Expect: CodeLens ⚠️ ambiguous — not a silent ✅ bound
    Given I have entered 10 into the calculator
    And I have entered 5 into the calculator
    When I press "add"
    Then the result should be 15 on the screen

  @v050 @outline-examples
  Scenario: Deposit logged from Examples table
    # Plain Scenario (not Outline) with Examples AFTER steps — v0.5.0 candidate refresh
    # Expect: CodeLens ✅ bound to LoggedAmountSteps (expanded rows 100, 250, 999)
    When I record a deposit of <amount> dollars
    Then the logged amount should be <amount>
    Examples:
      | amount |
      | 100    |
      | 250    |
      | 999    |

  # --- v0.6.0 Wave A (Cucumber Expressions) ---

  @v060 @cucumber-expressions
  Scenario: Cucumber Expressions bindings resolve
    # Expect: CodeLens ✅ bound (Cucumber Expressions → regex)
    Given I have 5 cucumbers
    When I search for "milk"
    Then I should see "milk" in results

  @v060 @stepdefinition
  Scenario: StepDefinition binds any keyword
    # Expect: CodeLens ✅ bound to the same method for Given/When/Then
    Given I do a generic step
    When I do a generic step
    Then I do a generic step

  # --- v1.10.0 Wave B (CE optional / alternation / type extras) ---

  @v110 @cucumber-expressions
  Scenario: Optional text cucumber(s) binds both forms
    # Expect: CodeLens ✅ bound (optional text); pattern distinct from Wave A
    Given I own 1 cucumber
    And I own 2 cucumbers

  @v110 @cucumber-expressions
  Scenario: Alternation a/an binds both forms
    # Expect: CodeLens ✅ bound (alternation)
    When I ate a banana
    And I ate an apple

  @v110 @cucumber-expressions
  Scenario: Built-in type extra {long} binds
    # Expect: CodeLens ✅ bound ({long})
    Then the balance should be 1000

  # --- v1.11.0 Scope-aware matching ---

  @v111 @web
  Scenario: Scoped login binds web method
    # Expect: CodeLens ✅ bound to LoginWeb (not ambiguous with LoginApi)
    Given I log in with scoped credentials

  @v111 @api
  Scenario: Scoped login binds api method
    # Expect: CodeLens ✅ bound to LoginApi
    Given I log in with scoped credentials

  @v111
  Scenario: Scoped login without web/api tag is unbound
    # Expect: CodeLens unbound (scoped-only bindings excluded)
    Given I log in with scoped credentials
