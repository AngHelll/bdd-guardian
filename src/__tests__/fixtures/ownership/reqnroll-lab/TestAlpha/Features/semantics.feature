Feature: Semantic compatibility

  Scenario: Marked binding is discovered
    Given the marked binding fires

  Scenario: Qualified binding class is discovered
    Given the qualified binding class fires

  Scenario: Qualified given is discovered
    Given the qualified given matches

  Scenario: Given attribute suffix is discovered
    Given the given attribute suffix matches

  Scenario: Global given is discovered
    Given the global given matches

  Scenario: Nested binding is discovered
    Given the nested binding fires

  Scenario: Private nested binding is discovered
    Given the private nested binding fires

  Scenario: Outer binding keeps its step
    Given the outer binding keeps its step

  Scenario: Outer step after a nested class is not a binding
    Given the outer step follows a nested class

  Scenario: Partial step is visible
    Given the partial step is visible

  Scenario: Partial loose attribute is not a binding
    Given the partial loose attribute fires

  Scenario: And and But after Given
    Given the conjunction anchor is given
    And the and step follows given
    But the but step follows given

  Scenario: And and But after When
    When the conjunction anchor is when
    And the and step follows when
    But the but step follows when

  Scenario: And after When does not use Given
    When the conjunction anchor is when
    And the and step only has a given

  Scenario: Star after Given
    Given the conjunction anchor is given
    * the star step follows given

  Scenario: Star opens the scenario
    * the star step opens the scenario
