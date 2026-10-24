from pytest_bdd import given, when, then


@given('I have {count:d} cucumbers')
def have_cucumbers(count):
    assert int(count) >= 0


@when('I search for milk')
def search_milk():
    pass
