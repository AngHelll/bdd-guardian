from behave import given, when, then


@given('I have {n} cucumbers')
def step_given_cukes(context, n):
    context.count = int(n)


@when('I search for {query}')
def step_when_search(context, query):
    context.query = query


@then('I should see "{message}" in results')
def step_then_results(context, message):
    if not message:
        raise AssertionError('expected message missing')
