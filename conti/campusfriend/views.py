from decimal import Decimal

from django import forms
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404, redirect, render

from .models import Category, Order, OrderItem, Product

CART_SESSION_ID = 'cart'


class OrderCreateForm(forms.ModelForm):
    quantity = forms.IntegerField(min_value=1, initial=1)

    class Meta:
        model = Order
        fields = ['first_name', 'last_name', 'email', 'address', 'city', 'postcode', 'country']


class CartAddProductForm(forms.Form):
    quantity = forms.IntegerField(min_value=1, initial=1)


class CheckoutForm(forms.ModelForm):
    class Meta:
        model = Order
        fields = ['first_name', 'last_name', 'email', 'address', 'city', 'postcode', 'country']


class LoginForm(forms.Form):
    username = forms.CharField(max_length=150)
    password = forms.CharField(widget=forms.PasswordInput)


def product_list(request):
    products = Product.objects.all()
    categories = Category.objects.all()
    return render(request, 'campusfriend/home.html', {
        'products': products,
        'categories': categories
    })


def product_detail(request, id):
    product = get_object_or_404(Product, id=id)
    form = CartAddProductForm(initial={'quantity': 1})
    return render(request, 'campusfriend/product_detail.html', {
        'product': product,
        'form': form,
    })


def add_to_cart(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    if request.method == 'POST':
        form = CartAddProductForm(request.POST)
        if form.is_valid():
            quantity = form.cleaned_data['quantity']
            cart = request.session.get(CART_SESSION_ID, {})
            item = cart.get(str(product_id), {
                'quantity': 0,
                'price': str(product.price),
                'name': product.name,
            })
            item['quantity'] += quantity
            cart[str(product_id)] = item
            request.session[CART_SESSION_ID] = cart
            request.session.modified = True
            return redirect('cart_view')
    return redirect('product_detail', id=product_id)


def _get_cart_items(request):
    cart = request.session.get(CART_SESSION_ID, {})
    cart_items = []
    total = Decimal('0.00')

    for product_id, item in cart.items():
        product = get_object_or_404(Product, id=product_id)
        price = Decimal(item['price'])
        quantity = item['quantity']
        line_total = price * quantity
        total += line_total
        cart_items.append({
            'product': product,
            'quantity': quantity,
            'price': price,
            'line_total': line_total,
        })

    return cart_items, total


def cart_view(request):
    cart_items, total = _get_cart_items(request)
    return render(request, 'campusfriend/cart_detail.html', {
        'cart_items': cart_items,
        'total': total,
    })


def checkout(request):
    cart_items, total = _get_cart_items(request)
    if not cart_items:
        return redirect('cart_view')

    if request.method == 'POST':
        form = CheckoutForm(request.POST)
        if form.is_valid():
            order = form.save(commit=False)
            if request.user.is_authenticated:
                order.user = request.user
            order.save()

            for item in cart_items:
                OrderItem.objects.create(
                    order=order,
                    product=item['product'],
                    price=item['price'],
                    quantity=item['quantity'],
                )

            request.session[CART_SESSION_ID] = {}
            request.session.modified = True
            return redirect('order_success', order_id=order.id)
    else:
        form = CheckoutForm()

    return render(request, 'campusfriend/checkout.html', {
        'form': form,
        'cart_items': cart_items,
        'total': total,
    })


cart_detail = cart_view


def order_create(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    if request.method == 'POST':
        form = OrderCreateForm(request.POST)
        if form.is_valid():
            order = form.save(commit=False)
            if request.user.is_authenticated:
                order.user = request.user
            order.save()

            quantity = form.cleaned_data['quantity']
            OrderItem.objects.create(
                order=order,
                product=product,
                price=product.price,
                quantity=quantity,
            )

            return redirect('order_success', order_id=order.id)
    else:
        form = OrderCreateForm(initial={'quantity': 1})

    return render(request, 'campusfriend/order_create.html', {
        'product': product,
        'form': form,
    })


def order_success(request, order_id):
    order = get_object_or_404(Order, id=order_id)
    return render(request, 'campusfriend/order_success.html', {
        'order': order,
    })


def register_view(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('product_list')
    else:
        form = UserCreationForm()
    return render(request, 'campusfriend/register.html', {'form': form})


def login_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return redirect('product_list')
            else:
                form.add_error(None, 'Invalid credentials')
    else:
        form = LoginForm()
    return render(request, 'campusfriend/login.html', {'form': form})


def logout_view(request):
    logout(request)
    return redirect('product_list')
