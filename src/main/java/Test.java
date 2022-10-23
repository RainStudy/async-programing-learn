import java.math.BigInteger;

/**
 * PACKAGE_NAME.null.java
 * kotlin-coroutine
 *
 * @author 寒雨
 * @since 2022/10/23 下午7:55
 */
public class Test {

    public static void main(String[] args) {
        System.out.println(calc(10));
    }

    public static BigInteger calc(int x) {
        BigInteger sum = BigInteger.valueOf(1);
        for (int i = 1; i <= x; i++) {
            sum = sum.multiply(BigInteger.valueOf(i));
        }
        return sum;
    }
}
