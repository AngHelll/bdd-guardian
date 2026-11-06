Feature: Other

  @v124
  Scenario: Outside feature scope
    # Expect: unbound. The binding is Scope(Feature = "Allowed").
    Given a feature scoped step

  @v124 @outline-rows
  Scenario Outline: State rows
    # Expect: bound. ready → Ready, pending → Pending. Not ambiguous.
    Given state is <state>
    Examples:
      | state   |
      | ready   |
      | pending |

  @v124
  Scenario: Fixed amount
    # Expect: bound to Amount. Two attributes, one method.
    Then amount is 10

  @v124
  Scenario: Configuration without a table
    # Expect: bound to WithoutTable
    Given configuration exists

  @v124
  Scenario: Configuration with a table
    # Expect: bound to WithTable
    Given configuration exists
      | name  | value |
      | theme | dark  |
